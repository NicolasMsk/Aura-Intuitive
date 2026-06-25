/* ═══════════════════════════════════════════════════════
   AURA INTUITIVE — Server (TypeScript)
   Express + Stripe Webhooks + Supabase + Resend
   ═══════════════════════════════════════════════════════ */

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import path from 'path';
import cookieSession from 'cookie-session';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import Stripe from 'stripe';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import type { Consultation, SubmitBody, RespondBody, LoginBody } from './types';

/* ── Env validation ─────────────────────────────────── */

const required = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'RESEND_API_KEY',
  'ADMIN_PASSWORD',
] as const;

for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌  Missing env variable: ${key}`);
    process.exit(1);
  }
}

/* ── Clients ────────────────────────────────────────── */

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabase: SupabaseClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

const resend = new Resend(process.env.RESEND_API_KEY!);

const PORT = Number(process.env.PORT) || 3000;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Aura Intuitive <noreply@auraintuitive.com>';

/* ── Express setup ──────────────────────────────────── */

const app = express();

const isProduction = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT;

// Trust Railway proxy (needed for rate limiting & secure cookies)
if (isProduction) {
  app.set('trust proxy', 1);
}

// Gzip compression
app.use(compression());

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts in admin
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting — general (100 req / 15 min per IP)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, veuillez réessayer plus tard.' },
});

// Rate limiting — strict for login (5 attempts / 15 min)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
});

// Stripe webhook needs raw body — must be BEFORE express.json()
app.post(
  '/api/webhook',
  express.raw({ type: 'application/json' }),
  webhookHandler,
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply general rate limiter to API routes
app.use('/api/', generalLimiter);

app.use(
  cookieSession({
    name: 'aura_admin',
    keys: [process.env.ADMIN_PASSWORD!],
    maxAge: 24 * 60 * 60 * 1000, // 24h
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction, // HTTPS only in production
  }),
);

// Static assets with cache (images, CSS, JS: 30 days)
app.use('/images', express.static(path.join(__dirname, '..', 'public', 'images'), {
  redirect: false,
  maxAge: '30d',
}));
app.use('/style.css', express.static(path.join(__dirname, '..', 'public', 'style.css'), {
  maxAge: '7d',
}));

// Other static files (HTML: no cache)
app.use(express.static(path.join(__dirname, '..', 'public'), { redirect: false }));

/* ═══════════════════════════════════════════════════════
   ROUTES
   ═══════════════════════════════════════════════════════ */

/* ── 1. Stripe Webhook ──────────────────────────────── */

async function webhookHandler(req: Request, res: Response): Promise<void> {
  const sig = req.headers['stripe-signature'] as string | undefined;

  if (!sig) {
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err: any) {
    console.error('⚠️  Webhook signature verification failed:', err.message);
    res.status(400).json({ error: `Webhook Error: ${err.message}` });
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    const amountTotal = session.amount_total ?? 0; // in cents
    let service: string;

    // 1. Prefer explicit Stripe Payment Link metadata `service`
    //    (used for promos at non-standard prices, e.g. €5 Ressenti)
    const metadataService = (session.metadata?.service ?? '').trim();
    if (metadataService === 'Consultation Ressenti' || metadataService === 'Réponse Oui / Non') {
      service = metadataService;
    } else if (amountTotal >= 1000 || amountTotal === 500) {
      // €10+ standard Ressenti, OR €5 promo fidélité (-50%)
      service = 'Consultation Ressenti';
    } else {
      service = 'Réponse Oui / Non';
    }

    const { error } = await supabase.from('consultations').insert({
      stripe_session_id: session.id,
      service,
      amount: amountTotal / 100,
      status: 'paid',
      customer_email: session.customer_details?.email || null,
    });

    if (error) {
      console.error('❌  Supabase insert error:', error);
    } else {
      console.log(`✅  New consultation: ${service} (${amountTotal / 100}€) — session ${session.id}`);
    }
  }

  res.json({ received: true });
}

/* ── 2. Form page (GET /form) ───────────────────────── */

app.get('/form', async (req: Request, res: Response): Promise<void> => {
  const sessionId = req.query.session_id as string | undefined;

  if (!sessionId) {
    res.redirect('/#services');
    return;
  }

  // Check in DB
  const { data, error } = await supabase
    .from('consultations')
    .select('status')
    .eq('stripe_session_id', sessionId)
    .single();

  if (error || !data) {
    // Maybe webhook hasn't fired yet — verify with Stripe
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== 'paid') {
        res.redirect('/#services');
        return;
      }
      // Webhook delayed — wait and serve the form anyway
      // The submit endpoint will also verify
    } catch {
      res.redirect('/#services');
      return;
    }
  } else if (data.status !== 'paid') {
    // Already submitted
    res.sendFile(path.join(__dirname, '..', 'public', 'already-submitted.html'));
    return;
  }

  res.sendFile(path.join(__dirname, '..', 'public', 'form.html'));
});

/* ── 2b. Form page EN (GET /en/form) ────────────────── */

app.get('/en/form', async (req: Request, res: Response): Promise<void> => {
  const sessionId = req.query.session_id as string | undefined;

  if (!sessionId) {
    res.redirect('/en/#services');
    return;
  }

  const { data, error } = await supabase
    .from('consultations')
    .select('status')
    .eq('stripe_session_id', sessionId)
    .single();

  if (error || !data) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== 'paid') {
        res.redirect('/en/#services');
        return;
      }
    } catch {
      res.redirect('/en/#services');
      return;
    }
  } else if (data.status !== 'paid') {
    res.sendFile(path.join(__dirname, '..', 'public', 'en', 'already-submitted.html'));
    return;
  }

  res.sendFile(path.join(__dirname, '..', 'public', 'en', 'form.html'));
});

/* ── 3. Submit question (POST /api/submit) ──────────── */

app.post('/api/submit', async (req: Request, res: Response): Promise<void> => {
  const { session_id, name, email, birthdate, person_concerned, message, lang } = req.body as SubmitBody;
  const normalizedLang: 'fr' | 'en' = lang === 'en' ? 'en' : 'fr';

  if (!session_id || !name || !email || !birthdate || !message) {
    res.status(400).json({ error: 'Champs obligatoires manquants.' });
    return;
  }

  // Verify consultation exists and is in "paid" status
  const { data: consultation, error: fetchError } = await supabase
    .from('consultations')
    .select('*')
    .eq('stripe_session_id', session_id)
    .single();

  if (fetchError || !consultation) {
    // Double check with Stripe
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id);
      if (session.payment_status !== 'paid') {
        res.status(403).json({ error: 'Paiement non vérifié.' });
        return;
      }
      // Create the record if webhook was delayed
      const amountTotal = session.amount_total ?? 0;
      const metadataService = (session.metadata?.service ?? '').trim();
      const service = (metadataService === 'Consultation Ressenti' || metadataService === 'Réponse Oui / Non')
        ? metadataService
        : ((amountTotal >= 1000 || amountTotal === 500) ? 'Consultation Ressenti' : 'Réponse Oui / Non');

      const { error: insertError } = await supabase.from('consultations').insert({
        stripe_session_id: session_id,
        service,
        amount: amountTotal / 100,
        status: 'submitted',
        customer_email: session.customer_details?.email || email,
        name,
        email,
        birthdate: birthdate || null,
        person_concerned: person_concerned || null,
        message,
        submitted_at: new Date().toISOString(),
        lang: normalizedLang,
      });

      if (insertError) {
        console.error('❌  Insert on submit:', insertError);
        res.status(500).json({ error: 'Erreur lors de l\'enregistrement.' });
        return;
      }

      // Send service-specific confirmation email
      try {
        const isRessenti = service === 'Consultation Ressenti';
        const emailHtml = normalizedLang === 'en'
          ? (isRessenti ? buildConfirmationEmailRessentiEN(name) : buildConfirmationEmailOuiNonEN(name))
          : (isRessenti ? buildConfirmationEmailRessenti(name) : buildConfirmationEmailOuiNon(name));
        const subject = normalizedLang === 'en'
          ? (isRessenti
              ? '✨ Your Intuitive Reading has been received — Aura Intuitive'
              : '✨ Your Yes / No Answer has been received — Aura Intuitive')
          : (isRessenti
              ? '✨ Votre Consultation Ressenti a bien été reçue — Aura Intuitive'
              : '✨ Votre Réponse Oui / Non a bien été reçue — Aura Intuitive');
        await resend.emails.send({ from: EMAIL_FROM, to: email, subject, html: emailHtml });
        console.log(`📧  Confirmation email (${service}) sent to ${email}`);
      } catch (err: any) {
        console.error('⚠️  Confirmation email failed:', err.message);
      }

      // Alerte admin — nouvelle question
      try {
        await resend.emails.send({
          from: EMAIL_FROM,
          to: 'lizarragasanchezsarah@outlook.fr',
          subject: `🔔 Nouvelle question (${service} — ${amountTotal / 100}€) — ${name}`,
          html: buildAdminAlertEmail(name, email, service, amountTotal / 100, message),
        });
        console.log(`🔔  Admin alert sent for ${service}`);
      } catch (err: any) {
        console.error('⚠️  Admin alert email failed:', err.message);
      }

      res.json({ success: true });
      return;
    } catch {
      res.status(403).json({ error: 'Session de paiement invalide.' });
      return;
    }
  }

  if (consultation.status !== 'paid') {
    res.status(400).json({ error: 'Vous avez déjà soumis votre question pour cette consultation.' });
    return;
  }

  // Update the consultation with form data
  const { error: updateError } = await supabase
    .from('consultations')
    .update({
      status: 'submitted',
      name,
      email,
      birthdate: birthdate || null,
      person_concerned: person_concerned || null,
      message,
      submitted_at: new Date().toISOString(),
      lang: normalizedLang,
    })
    .eq('stripe_session_id', session_id);

  if (updateError) {
    console.error('❌  Update error:', updateError);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement.' });
    return;
  }

  // Send service-specific confirmation email
  const serviceName = consultation.service || 'Consultation Ressenti';
  try {
    const isRessenti = serviceName === 'Consultation Ressenti';
    const emailHtml = normalizedLang === 'en'
      ? (isRessenti ? buildConfirmationEmailRessentiEN(name) : buildConfirmationEmailOuiNonEN(name))
      : (isRessenti ? buildConfirmationEmailRessenti(name) : buildConfirmationEmailOuiNon(name));
    const subject = normalizedLang === 'en'
      ? (isRessenti
          ? '✨ Your Intuitive Reading has been received — Aura Intuitive'
          : '✨ Your Yes / No Answer has been received — Aura Intuitive')
      : (isRessenti
          ? '✨ Votre Consultation Ressenti a bien été reçue — Aura Intuitive'
          : '✨ Votre Réponse Oui / Non a bien été reçue — Aura Intuitive');
    await resend.emails.send({ from: EMAIL_FROM, to: email, subject, html: emailHtml });
    console.log(`📧  Confirmation email (${serviceName}) sent to ${email}`);
  } catch (err: any) {
    console.error('⚠️  Confirmation email failed:', err.message);
  }

  // Alerte admin — nouvelle question
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: 'lizarragasanchezsarah@outlook.fr',
      subject: `🔔 Nouvelle question (${serviceName} — ${consultation.amount}€) — ${name}`,
      html: buildAdminAlertEmail(name, email, serviceName, consultation.amount, message),
    });
    console.log(`🔔  Admin alert sent for ${serviceName}`);
  } catch (err: any) {
    console.error('⚠️  Admin alert email failed:', err.message);
  }

  console.log(`📩  Question submitted for session ${session_id}`);
  res.json({ success: true });
});

/* ═══════════════════════════════════════════════════════
   ADMIN
   ═══════════════════════════════════════════════════════ */

/* ── Admin login ────────────────────────────────────── */

app.post('/api/admin/login', loginLimiter, (req: Request, res: Response): void => {
  const { password } = req.body as LoginBody;

  if (password === process.env.ADMIN_PASSWORD) {
    req.session!.admin = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Mot de passe incorrect.' });
  }
});

/* ── Admin logout ───────────────────────────────────── */

app.post('/api/admin/logout', (_req: Request, res: Response): void => {
  _req.session = null;
  res.json({ success: true });
});

/* ── Admin middleware ───────────────────────────────── */

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.admin) {
    next();
  } else {
    res.status(401).json({ error: 'Non autorisé.' });
  }
}

/* ── Stats ──────────────────────────────────────────── */

app.get('/api/admin/stats', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const { data, error } = await supabase
    .from('consultations')
    .select('status, amount, created_at')
    .in('status', ['submitted', 'answered']);

  if (error) {
    res.status(500).json({ error: 'Erreur base de données.' });
    return;
  }

  const all = data ?? [];

  // Tout filtrer sur le mois en cours
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonth = all.filter(c => new Date(c.created_at) >= monthStart);

  const total = thisMonth.length;
  const pending = thisMonth.filter(c => c.status === 'submitted').length;
  const answered = thisMonth.filter(c => c.status === 'answered').length;
  const revenue = thisMonth.reduce((sum, c) => sum + (c.amount || 0), 0);

  res.json({ total, pending, answered, revenue });
});

/* ── Dashboard Analytics ────────────────────────────── */

app.get('/api/admin/dashboard', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const { data, error } = await supabase
    .from('consultations')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    res.status(500).json({ error: 'Erreur base de données.' });
    return;
  }

  res.json(data ?? []);
});

/* ── About page ─────────────────────────────────────── */

app.get('/a-propos', (_req: Request, res: Response): void => {
  res.sendFile(path.join(__dirname, '..', 'public', 'a-propos.html'));
});

/* ── Legal page ──────────────────────────────────────── */

app.get('/mentions-legales', (_req: Request, res: Response): void => {
  res.sendFile(path.join(__dirname, '..', 'public', 'mentions-legales.html'));
});

/* ── Blog pages ──────────────────────────────────────── */

app.get('/blog', (_req: Request, res: Response): void => {
  res.sendFile(path.join(__dirname, '..', 'public', 'blog', 'index.html'));
});

app.get('/blog/:slug', (req: Request, res: Response): void => {
  const slug = (req.params.slug as string).replace(/[^a-z0-9-]/g, '');
  const filePath = path.join(__dirname, '..', 'public', 'blog', `${slug}.html`);
  res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) res.status(404).send('Article introuvable.');
  });
});

/* ── Serve dashboard page ───────────────────────────── */

app.get('/dashboard', (_req: Request, res: Response): void => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

/* ── List consultations ─────────────────────────────── */

app.get('/api/admin/consultations', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const { data, error } = await supabase
    .from('consultations')
    .select('*')
    .in('status', ['submitted', 'answered'])
    .order('submitted_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: 'Erreur base de données.' });
    return;
  }

  res.json(data ?? []);
});

/* ── Respond to consultation ────────────────────────── */

app.post('/api/admin/respond', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { id, response } = req.body as RespondBody;

  if (!id || !response) {
    res.status(400).json({ error: 'Champs manquants.' });
    return;
  }

  // Get the consultation
  const { data: consultation, error: fetchError } = await supabase
    .from('consultations')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !consultation) {
    res.status(404).json({ error: 'Consultation introuvable.' });
    return;
  }

  // Update status first (always save the response)
  const { error: updateError } = await supabase
    .from('consultations')
    .update({
      status: 'answered',
      response,
      answered_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateError) {
    console.error('❌  Update error:', updateError);
    res.status(500).json({ error: 'Erreur lors de la mise à jour.' });
    return;
  }

  // Try to send email (best effort — don't block if it fails)
  let emailSent = false;
  let resendEmailId: string | null = null;
  const c = consultation as Consultation;
  const isEN = c.lang === 'en';
  const serviceEN = c.service === 'Consultation Ressenti' ? 'Intuitive Reading' : 'Yes / No Answer';
  try {
    const emailResult = await resend.emails.send({
      from: EMAIL_FROM,
      to: c.email!,
      subject: isEN
        ? `🔮 Your Aura Intuitive guidance — ${serviceEN}`
        : `🔮 Votre guidance Aura Intuitive — ${c.service}`,
      html: isEN
        ? buildResponseEmailEN(c, response)
        : buildResponseEmail(c, response),
    });
    emailSent = true;
    resendEmailId = emailResult.data?.id || null;
    console.log(`✨  Response sent + email delivered for consultation ${id} (Resend ID: ${resendEmailId})`);

    // Save Resend email ID for tracking
    if (resendEmailId) {
      await supabase
        .from('consultations')
        .update({ resend_email_id: resendEmailId, email_status: 'sent' })
        .eq('id', id);
    }
  } catch (err: any) {
    console.error('⚠️  Email send failed (response saved anyway):', err.message);
    await supabase
      .from('consultations')
      .update({ email_status: 'failed' })
      .eq('id', id);
  }

  res.json({
    success: true,
    emailSent,
    resendEmailId,
    message: emailSent
      ? 'Réponse enregistrée et email envoyé !'
      : 'Réponse enregistrée ✅ mais l\'email n\'a pas pu être envoyé. Vous pouvez copier la réponse et l\'envoyer manuellement.',
  });
});

/* ── Check email delivery status ────────────────────── */

app.get('/api/admin/email-status/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  // Get the consultation to find the Resend email ID
  const { data: consultation, error } = await supabase
    .from('consultations')
    .select('resend_email_id, email_status, email')
    .eq('id', id)
    .single();

  if (error || !consultation) {
    res.status(404).json({ error: 'Consultation introuvable.' });
    return;
  }

  if (!consultation.resend_email_id) {
    res.json({
      status: consultation.email_status || 'unknown',
      label: consultation.email_status === 'failed' ? '❌ Échec d\'envoi' : '⚠️ Pas de suivi disponible',
      detail: 'Aucun ID de suivi Resend enregistré pour cet email.',
    });
    return;
  }

  // Query Resend API for the actual delivery status
  try {
    // Use direct HTTP call to Resend API for reliability
    const resendResponse = await fetch(`https://api.resend.com/emails/${consultation.resend_email_id}`, {
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY!}` },
    });
    const emailInfo = await resendResponse.json() as Record<string, any>;
    console.log('📧  Resend status response:', JSON.stringify(emailInfo));

    if (!resendResponse.ok || !emailInfo || !emailInfo.id) {
      res.json({
        status: 'unknown',
        label: '⚠️ Impossible de vérifier',
        detail: `L'API Resend a retourné une erreur: ${emailInfo?.message || emailInfo?.error || 'inconnue'}`,
      });
      return;
    }

    const lastEvent = emailInfo.last_event || 'sent';

    // Map Resend events to French labels
    const statusMap: Record<string, { label: string; detail: string }> = {
      'sent':        { label: '📤 Envoyé', detail: 'L\'email a été envoyé par nos serveurs.' },
      'delivered':   { label: '✅ Délivré', detail: `L\'email a bien été reçu par la boîte mail ${consultation.email}.` },
      'opened':      { label: '👁️ Ouvert', detail: `Le client a ouvert l\'email ! (${consultation.email})` },
      'clicked':     { label: '🖱️ Cliqué', detail: 'Le client a cliqué sur un lien dans l\'email.' },
      'bounced':     { label: '❌ Rejeté (Bounce)', detail: `L\'adresse ${consultation.email} n\'existe pas ou a rejeté l\'email. Vérifiez l\'adresse et renvoyez manuellement.` },
      'complained':  { label: '🚫 Signalé spam', detail: 'Le client a marqué l\'email comme spam.' },
      'delivery_delayed': { label: '⏳ En attente', detail: 'La délivrance est retardée. Réessayez plus tard.' },
    };

    const statusInfo = statusMap[lastEvent] || { label: `📧 ${lastEvent}`, detail: `Statut Resend: ${lastEvent}` };

    // Update status in DB
    await supabase
      .from('consultations')
      .update({ email_status: lastEvent })
      .eq('id', id);

    res.json({
      status: lastEvent,
      label: statusInfo.label,
      detail: statusInfo.detail,
      resendId: consultation.resend_email_id,
      sentAt: emailInfo.created_at || null,
    });
  } catch (err: any) {
    console.error('⚠️  Resend status check failed:', err.message);
    res.json({
      status: 'error',
      label: '⚠️ Erreur de vérification',
      detail: 'Impossible de contacter l\'API Resend. Réessayez dans quelques instants.',
    });
  }
});

/* ── Delete consultation ─────────────────────────────── */

app.delete('/api/admin/consultations/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const { error } = await supabase
    .from('consultations')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('❌  Delete error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression.' });
    return;
  }

  console.log(`🗑️  Consultation ${id} deleted`);
  res.json({ success: true });
});

/* ── Serve admin page ───────────────────────────────── */

app.get('/admin', (_req: Request, res: Response): void => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

/* ═══════════════════════════════════════════════════════
   CAMPAIGN ENDPOINTS
   ═══════════════════════════════════════════════════════ */

/* ── Campaign recipients ────────────────────────────── */

app.get('/api/admin/campaign/recipients', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const filter = (req.query.filter as string) || 'all';
  const lang = (req.query.lang as string) || 'all';

  // Fetch all consultations with relevant statuses
  let query = supabase
    .from('consultations')
    .select('email, name, lang, created_at')
    .in('status', ['submitted', 'answered']);

  const { data, error } = await query;

  if (error) {
    res.status(500).json({ error: 'Erreur base de données.' });
    return;
  }

  const rows = data ?? [];

  // Deduplicate by lowercased email — keep most recent name and track counts/dates
  const emailMap = new Map<string, { email: string; name: string; lang: string | null; consult_count: number; last_consult: string }>();

  // Sort by created_at descending so most recent comes first
  const sorted = [...rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  for (const row of sorted) {
    if (!row.email) continue;
    const key = row.email.toLowerCase().trim();
    if (!emailMap.has(key)) {
      emailMap.set(key, {
        email: key,
        name: (row.name || '').trim(),
        lang: row.lang || null,
        consult_count: 1,
        last_consult: row.created_at ? row.created_at.substring(0, 10) : '',
      });
    } else {
      const existing = emailMap.get(key)!;
      existing.consult_count += 1;
      // Update name to most recent (already sorted desc, so first hit is most recent)
      // keep existing.name as it was set from the first (most recent) row
    }
  }

  let recipients = Array.from(emailMap.values());

  // Apply lang filter
  if (lang === 'fr') {
    recipients = recipients.filter(r => !r.lang || r.lang === 'fr');
  } else if (lang === 'en') {
    recipients = recipients.filter(r => r.lang === 'en');
  }

  // Apply segment filter
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);

  if (filter === 'superfans') {
    recipients = recipients.filter(r => r.consult_count >= 3);
  } else if (filter === 'repeat') {
    recipients = recipients.filter(r => r.consult_count === 2);
  } else if (filter === 'oneshot') {
    recipients = recipients.filter(r => r.consult_count === 1);
  } else if (filter === 'active') {
    recipients = recipients.filter(r => r.last_consult >= thirtyDaysAgo);
  } else if (filter === 'inactive') {
    recipients = recipients.filter(r => r.last_consult < sixtyDaysAgo);
  }
  // 'all' — no extra filter

  res.json({ count: recipients.length, recipients });
});

/* ── Campaign preview ────────────────────────────────── */

app.post('/api/admin/campaign/preview', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { subject, body, cta_text, cta_url } = req.body as {
    subject?: string;
    body?: string;
    cta_text?: string;
    cta_url?: string;
  };

  if (!body) {
    res.status(400).json({ error: 'body requis.' });
    return;
  }

  // Replace {prenom} with sample name for preview
  const previewBody = body.replace(/\{prenom\}/gi, 'Marie');
  const previewSubject = (req.body.subject || '').toString().replace(/\{prenom\}/gi, 'Marie');

  const html = buildCampaignEmail({ bodyText: previewBody, ctaText: cta_text, ctaUrl: cta_url });
  res.json({ html, subject: previewSubject });
});

/* ── Campaign send ───────────────────────────────────── */

app.post('/api/admin/campaign/send', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { subject, body, cta_text, cta_url, recipients, test_only } = req.body as {
    subject: string;
    body: string;
    cta_text?: string;
    cta_url?: string;
    recipients: Array<{ email: string; name?: string }>;
    test_only?: boolean;
  };

  if (!subject || !body) {
    res.status(400).json({ error: 'subject et body sont requis.' });
    return;
  }

  if (!recipients || recipients.length === 0) {
    res.status(400).json({ error: 'Au moins un destinataire requis.' });
    return;
  }

  const targetRecipients = test_only ? [recipients[0]] : recipients;

  // Extract first name helper
  const getPrenom = (name?: string): string => {
    if (!name) return '';
    return name.trim().split(/\s+/)[0] || '';
  };

  // Build batch of email payloads, chunked at 100
  const CHUNK = 100;
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < targetRecipients.length; i += CHUNK) {
    const chunk = targetRecipients.slice(i, i + CHUNK);
    const batch = chunk.map(r => {
      const prenom = getPrenom(r.name);
      const personalizedBody = body.replace(/\{prenom\}/gi, prenom);
      const personalizedSubject = subject.replace(/\{prenom\}/gi, prenom);
      return {
        from: EMAIL_FROM,
        to: r.email.toLowerCase().trim(),
        subject: personalizedSubject,
        html: buildCampaignEmail({ bodyText: personalizedBody, ctaText: cta_text, ctaUrl: cta_url }),
      };
    });

    try {
      const result = await resend.batch.send(batch);
      // resend.batch.send returns { data: Array<{id}|null> | null, error }
      if (result.error) {
        console.error('⚠️  Campaign batch error:', result.error);
        failed += chunk.length;
        errors.push(`Batch ${Math.floor(i / CHUNK) + 1}: ${(result.error as any).message || JSON.stringify(result.error)}`);
      } else {
        // CreateBatchSuccessResponse may be an object with a `data` array property
        const rawData = result.data as unknown;
        const resultsArr: Array<{ id: string } | null> = Array.isArray(rawData)
          ? rawData
          : (rawData && typeof rawData === 'object' && 'data' in rawData && Array.isArray((rawData as any).data))
            ? (rawData as any).data
            : [];
        for (let j = 0; j < chunk.length; j++) {
          if (resultsArr[j]) {
            sent += 1;
          } else {
            failed += 1;
            errors.push(`${chunk[j].email}: no response`);
          }
        }
      }
    } catch (err: any) {
      console.error('⚠️  Campaign batch exception:', err.message);
      failed += chunk.length;
      errors.push(`Batch ${Math.floor(i / CHUNK) + 1}: ${err.message}`);
    }
  }

  console.log(`📨 Campaign sent: ${sent} successful, ${failed} failed`);
  res.json({ sent, failed, errors });
});

/* ═══════════════════════════════════════════════════════
   EMAIL TEMPLATES
   ═══════════════════════════════════════════════════════ */

/* ── Campaign email template ─────────────────────────── */

function buildCampaignEmail(opts: {
  bodyText: string;
  ctaText?: string;
  ctaUrl?: string;
}): string {
  // Convert text to HTML paragraphs (split on \n\n for paragraphs, \n inside for line breaks)
  const paragraphsHtml = opts.bodyText
    .split(/\n\n+/)
    .map(p => `<p style="margin:0 0 16px;line-height:1.7;font-size:15px;color:#e8d5c4;">${
      p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
    }</p>`)
    .join('');

  const ctaHtml = (opts.ctaText && opts.ctaUrl)
    ? `<div style="text-align:center;margin:32px 0;">
         <a href="${opts.ctaUrl}" style="display:inline-block;background:linear-gradient(135deg,#d4a76a,#b8894f);color:#1a0a10;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;letter-spacing:1px;">
           ${opts.ctaText}
         </a>
       </div>`
    : '';

  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#1a0a10;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:linear-gradient(135deg,#2a1520,#1a0a10);border:1px solid rgba(123,45,63,0.4);border-radius:16px;overflow:hidden;">

    <div style="background:linear-gradient(135deg,#7b2d3f,#5c1a2e);padding:32px 24px;text-align:center;">
      <h1 style="color:#d4a76a;margin:0;font-size:24px;letter-spacing:2px;">✦ Aura Intuitive ✦</h1>
      <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;font-size:14px;">Un mot personnel de Laura</p>
    </div>

    <div style="padding:32px 24px;">
      ${paragraphsHtml}
      ${ctaHtml}
    </div>

    <div style="border-top:1px solid rgba(123,45,63,0.3);padding:20px 24px;text-align:center;">
      <p style="color:rgba(232,213,196,0.4);font-size:11px;margin:0 0 6px;">
        Aura Intuitive — <a href="https://www.auraintuitive.fr" style="color:rgba(212,167,106,0.6);">auraintuitive.fr</a>
      </p>
      <p style="color:rgba(232,213,196,0.4);font-size:11px;margin:0;">
        Vous recevez cet email car vous avez fait appel à mes services.
        Pour ne plus recevoir d'emails, répondez avec "DÉSINSCRIPTION".
      </p>
    </div>
  </div>
</body>
</html>`;
}

/* ── Admin alert email — Nouvelle question ──────────── */

function buildAdminAlertEmail(name: string, email: string, service: string, amount: number, message: string): string {
  const isRessenti = service === 'Consultation Ressenti';
  const emoji = isRessenti ? '🌟' : '✨';
  const color = isRessenti ? '#d4a76a' : '#c0c0c0';
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#1a0a10;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:linear-gradient(135deg,#2a1520,#1a0a10);border:1px solid rgba(123,45,63,0.4);border-radius:16px;overflow:hidden;">

    <div style="background:linear-gradient(135deg,#7b2d3f,#5a1d2e);padding:30px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;">🔔 Nouvelle Question Reçue</h1>
    </div>

    <div style="padding:30px;">
      <div style="background:rgba(123,45,63,0.2);border:1px solid rgba(212,167,106,0.3);border-radius:12px;padding:20px;margin-bottom:20px;">
        <p style="color:${color};font-size:18px;font-weight:bold;margin:0 0 5px;">
          ${emoji} ${service} — ${amount}€
        </p>
      </div>

      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="color:#999;padding:8px 0;font-size:14px;border-bottom:1px solid rgba(255,255,255,0.05);width:120px;">Prénom</td>
          <td style="color:#e0d6cc;padding:8px 0;font-size:14px;border-bottom:1px solid rgba(255,255,255,0.05);font-weight:bold;">${name}</td>
        </tr>
        <tr>
          <td style="color:#999;padding:8px 0;font-size:14px;border-bottom:1px solid rgba(255,255,255,0.05);">Email</td>
          <td style="color:#e0d6cc;padding:8px 0;font-size:14px;border-bottom:1px solid rgba(255,255,255,0.05);">
            <a href="mailto:${email}" style="color:#d4a76a;text-decoration:none;">${email}</a>
          </td>
        </tr>
        <tr>
          <td style="color:#999;padding:8px 0;font-size:14px;">Montant</td>
          <td style="color:#e0d6cc;padding:8px 0;font-size:14px;font-weight:bold;">${amount}€</td>
        </tr>
      </table>

      <div style="margin-top:20px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px;">
        <p style="color:#999;font-size:12px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">Message du client</p>
        <p style="color:#e0d6cc;font-size:14px;line-height:1.6;margin:0;white-space:pre-wrap;">${message}</p>
      </div>

      <div style="text-align:center;margin-top:25px;">
        <a href="https://www.auraintuitive.fr/admin" style="display:inline-block;background:linear-gradient(135deg,#d4a76a,#b8894f);color:#1a0a10;padding:12px 30px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;">
          Répondre dans l'admin ✦
        </a>
      </div>
    </div>

    <div style="padding:20px;text-align:center;border-top:1px solid rgba(255,255,255,0.05);">
      <p style="color:#666;font-size:11px;margin:0;">Aura Intuitive — Notification automatique</p>
    </div>
  </div>
</body>
</html>`;
}

/* ── Confirmation email — Réponse Oui / Non ─────────── */

function buildConfirmationEmailOuiNon(name: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#1a0a10;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:linear-gradient(135deg,#2a1520,#1a0a10);border:1px solid rgba(123,45,63,0.4);border-radius:16px;overflow:hidden;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#7b2d3f,#5c1a2e);padding:32px 24px;text-align:center;">
      <h1 style="color:#d4a76a;margin:0;font-size:24px;letter-spacing:2px;">✦ Aura Intuitive ✦</h1>
      <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;font-size:14px;">Réponse Oui / Non</p>
    </div>

    <!-- Body -->
    <div style="padding:32px 24px;">
      <p style="color:#e8d5c4;font-size:16px;margin:0 0 8px;">Bonjour <strong>${name}</strong>,</p>
      <p style="color:rgba(232,213,196,0.8);font-size:14px;margin:0 0 24px;">
        Merci pour votre confiance ✨ Votre question a bien été reçue !
      </p>

      <!-- Info box -->
      <div style="background:rgba(123,45,63,0.15);border:1px solid rgba(212,167,106,0.3);border-radius:12px;padding:20px;margin:0 0 24px;">
        <p style="color:#d4a76a;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">🔮 Réponse Oui / Non — 1€</p>
        <p style="color:#e8d5c4;font-size:14px;margin:0;line-height:1.7;">
          Je vais me connecter à mon ressenti pour vous apporter une réponse courte et intuitive.
          Vous recevrez votre réponse par email <strong>sous 24h maximum</strong>.
        </p>
      </div>

      <p style="color:rgba(232,213,196,0.5);font-size:13px;margin:0;text-align:center;">
        Avec lumière et bienveillance,<br>
        <strong style="color:#d4a76a;">Laura — Aura Intuitive</strong>
      </p>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid rgba(123,45,63,0.3);padding:16px 24px;text-align:center;">
      <p style="color:rgba(232,213,196,0.3);font-size:11px;margin:0;">
        © 2026 Aura Intuitive — Cet email a été envoyé automatiquement, merci de ne pas y répondre.
      </p>
    </div>
  </div>
</body>
</html>`;
}

/* ── Confirmation email EN — Yes / No Answer ────────── */

function buildConfirmationEmailOuiNonEN(name: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#1a0a10;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:linear-gradient(135deg,#2a1520,#1a0a10);border:1px solid rgba(123,45,63,0.4);border-radius:16px;overflow:hidden;">

    <div style="background:linear-gradient(135deg,#7b2d3f,#5c1a2e);padding:32px 24px;text-align:center;">
      <h1 style="color:#d4a76a;margin:0;font-size:24px;letter-spacing:2px;">✦ Aura Intuitive ✦</h1>
      <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;font-size:14px;">Yes / No Answer</p>
    </div>

    <div style="padding:32px 24px;">
      <p style="color:#e8d5c4;font-size:16px;margin:0 0 8px;">Hello <strong>${name}</strong>,</p>
      <p style="color:rgba(232,213,196,0.8);font-size:14px;margin:0 0 24px;">
        Thank you for your trust ✨ Your question has been received!
      </p>

      <div style="background:rgba(123,45,63,0.15);border:1px solid rgba(212,167,106,0.3);border-radius:12px;padding:20px;margin:0 0 24px;">
        <p style="color:#d4a76a;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">🔮 Yes / No Answer — €1</p>
        <p style="color:#e8d5c4;font-size:14px;margin:0;line-height:1.7;">
          I will connect with my intuition to bring you a clear, short answer.
          You will receive your answer by email <strong>within 24 hours</strong>.
        </p>
      </div>

      <p style="color:rgba(232,213,196,0.5);font-size:13px;margin:0;text-align:center;">
        With light and kindness,<br>
        <strong style="color:#d4a76a;">Laura — Aura Intuitive</strong>
      </p>
    </div>

    <div style="border-top:1px solid rgba(123,45,63,0.3);padding:16px 24px;text-align:center;">
      <p style="color:rgba(232,213,196,0.3);font-size:11px;margin:0;">
        © 2026 Aura Intuitive — This is an automated email, please do not reply.
      </p>
    </div>
  </div>
</body>
</html>`;
}

/* ── Confirmation email — Consultation Ressenti ─────── */

function buildConfirmationEmailRessenti(name: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#1a0a10;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:linear-gradient(135deg,#2a1520,#1a0a10);border:1px solid rgba(123,45,63,0.4);border-radius:16px;overflow:hidden;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#7b2d3f,#5c1a2e);padding:32px 24px;text-align:center;">
      <h1 style="color:#d4a76a;margin:0;font-size:24px;letter-spacing:2px;">✦ Aura Intuitive ✦</h1>
      <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;font-size:14px;">Consultation Ressenti</p>
    </div>

    <!-- Body -->
    <div style="padding:32px 24px;">
      <p style="color:#e8d5c4;font-size:16px;margin:0 0 8px;">Bonjour <strong>${name}</strong>,</p>
      <p style="color:rgba(232,213,196,0.8);font-size:14px;margin:0 0 24px;">
        Merci pour votre confiance ✨ Votre demande de consultation a bien été reçue !
      </p>

      <!-- Info box -->
      <div style="background:rgba(123,45,63,0.15);border:1px solid rgba(212,167,106,0.3);border-radius:12px;padding:20px;margin:0 0 24px;">
        <p style="color:#d4a76a;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">🌙 Consultation Ressenti — 10€</p>
        <p style="color:#e8d5c4;font-size:14px;margin:0;line-height:1.7;">
          Je vais prendre le temps de me connecter à votre énergie et de vous offrir une guidance détaillée et personnalisée.
          Vous recevrez votre consultation complète par email <strong>sous 24h maximum</strong>.
        </p>
      </div>

      <!-- Disclaimer -->
      <div style="background:rgba(212,167,106,0.08);border:1px solid rgba(212,167,106,0.15);border-radius:8px;padding:14px;margin:0 0 16px;">
        <p style="color:rgba(232,213,196,0.5);font-size:12px;margin:0;line-height:1.6;">
          ⚠️ <strong>Important</strong> — En réservant une consultation, vous certifiez être majeur(e) (18 ans ou plus).
          La voyance ne se substitue en aucun cas à un avis médical, psychologique ou juridique.
          Les questions relatives à la santé, la grossesse, la médecine ou tout diagnostic ne seront pas traitées.
        </p>
      </div>

      <p style="color:rgba(232,213,196,0.5);font-size:13px;margin:0;text-align:center;">
        Avec lumière et bienveillance,<br>
        <strong style="color:#d4a76a;">Laura — Aura Intuitive</strong>
      </p>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid rgba(123,45,63,0.3);padding:16px 24px;text-align:center;">
      <p style="color:rgba(232,213,196,0.3);font-size:11px;margin:0;">
        © 2026 Aura Intuitive — Cet email a été envoyé automatiquement, merci de ne pas y répondre.
      </p>
    </div>
  </div>
</body>
</html>`;
}

/* ── Confirmation email EN — Intuitive Reading ──────── */

function buildConfirmationEmailRessentiEN(name: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#1a0a10;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:linear-gradient(135deg,#2a1520,#1a0a10);border:1px solid rgba(123,45,63,0.4);border-radius:16px;overflow:hidden;">

    <div style="background:linear-gradient(135deg,#7b2d3f,#5c1a2e);padding:32px 24px;text-align:center;">
      <h1 style="color:#d4a76a;margin:0;font-size:24px;letter-spacing:2px;">✦ Aura Intuitive ✦</h1>
      <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;font-size:14px;">Intuitive Reading</p>
    </div>

    <div style="padding:32px 24px;">
      <p style="color:#e8d5c4;font-size:16px;margin:0 0 8px;">Hello <strong>${name}</strong>,</p>
      <p style="color:rgba(232,213,196,0.8);font-size:14px;margin:0 0 24px;">
        Thank you for your trust ✨ Your consultation request has been received!
      </p>

      <div style="background:rgba(123,45,63,0.15);border:1px solid rgba(212,167,106,0.3);border-radius:12px;padding:20px;margin:0 0 24px;">
        <p style="color:#d4a76a;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">🌙 Intuitive Reading — €10</p>
        <p style="color:#e8d5c4;font-size:14px;margin:0;line-height:1.7;">
          I will take the time to connect with your energy and offer you a detailed, personalized guidance.
          You will receive your full reading by email <strong>within 24 hours</strong>.
        </p>
      </div>

      <div style="background:rgba(212,167,106,0.08);border:1px solid rgba(212,167,106,0.15);border-radius:8px;padding:14px;margin:0 0 16px;">
        <p style="color:rgba(232,213,196,0.5);font-size:12px;margin:0;line-height:1.6;">
          ⚠️ <strong>Important</strong> — By booking a reading, you certify that you are of legal age (18 or older).
          Psychic readings are no substitute for medical, psychological or legal advice.
          Questions about health, pregnancy, medicine or any diagnosis will not be answered.
        </p>
      </div>

      <p style="color:rgba(232,213,196,0.5);font-size:13px;margin:0;text-align:center;">
        With light and kindness,<br>
        <strong style="color:#d4a76a;">Laura — Aura Intuitive</strong>
      </p>
    </div>

    <div style="border-top:1px solid rgba(123,45,63,0.3);padding:16px 24px;text-align:center;">
      <p style="color:rgba(232,213,196,0.3);font-size:11px;margin:0;">
        © 2026 Aura Intuitive — This is an automated email, please do not reply.
      </p>
    </div>
  </div>
</body>
</html>`;
}

/* ── Response email (admin reply) ───────────────────── */

function buildResponseEmail(consultation: Consultation, response: string): string {
  const responseHtml = response.replace(/\n/g, '<br>');

  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#1a0a10;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:linear-gradient(135deg,#2a1520,#1a0a10);border:1px solid rgba(123,45,63,0.4);border-radius:16px;overflow:hidden;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#7b2d3f,#5c1a2e);padding:32px 24px;text-align:center;">
      <h1 style="color:#d4a76a;margin:0;font-size:24px;letter-spacing:2px;">✦ Aura Intuitive ✦</h1>
      <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;font-size:14px;">Votre guidance spirituelle</p>
    </div>

    <!-- Body -->
    <div style="padding:32px 24px;">
      <p style="color:#e8d5c4;font-size:16px;margin:0 0 8px;">Bonjour <strong>${consultation.name}</strong>,</p>
      <p style="color:rgba(232,213,196,0.7);font-size:14px;margin:0 0 24px;">
        Voici la réponse à votre <strong style="color:#d4a76a;">${consultation.service}</strong> :
      </p>

      <!-- Response box -->
      <div style="background:rgba(123,45,63,0.15);border:1px solid rgba(212,167,106,0.3);border-radius:12px;padding:24px;margin:0 0 24px;">
        <p style="color:#d4a76a;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">🔮 Ma guidance</p>
        <p style="color:#e8d5c4;font-size:15px;line-height:1.7;margin:0;">${responseHtml}</p>
      </div>

      <p style="color:rgba(232,213,196,0.5);font-size:13px;margin:0;text-align:center;">
        Merci de votre confiance. ✨<br>
        Avec lumière et bienveillance,<br>
        <strong style="color:#d4a76a;">Laura — Aura Intuitive</strong>
      </p>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid rgba(123,45,63,0.3);padding:16px 24px;text-align:center;">
      <p style="color:rgba(232,213,196,0.3);font-size:11px;margin:0;">
        © 2026 Aura Intuitive — Cet email a été envoyé automatiquement, merci de ne pas y répondre.
      </p>
    </div>
  </div>
</body>
</html>`;
}

/* ── Response email EN (admin reply) ────────────────── */

function buildResponseEmailEN(consultation: Consultation, response: string): string {
  const responseHtml = response.replace(/\n/g, '<br>');
  const serviceEN = consultation.service === 'Consultation Ressenti' ? 'Intuitive Reading' : 'Yes / No Answer';

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#1a0a10;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:linear-gradient(135deg,#2a1520,#1a0a10);border:1px solid rgba(123,45,63,0.4);border-radius:16px;overflow:hidden;">

    <div style="background:linear-gradient(135deg,#7b2d3f,#5c1a2e);padding:32px 24px;text-align:center;">
      <h1 style="color:#d4a76a;margin:0;font-size:24px;letter-spacing:2px;">✦ Aura Intuitive ✦</h1>
      <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;font-size:14px;">Your spiritual guidance</p>
    </div>

    <div style="padding:32px 24px;">
      <p style="color:#e8d5c4;font-size:16px;margin:0 0 8px;">Hello <strong>${consultation.name}</strong>,</p>
      <p style="color:rgba(232,213,196,0.7);font-size:14px;margin:0 0 24px;">
        Here is the answer to your <strong style="color:#d4a76a;">${serviceEN}</strong>:
      </p>

      <div style="background:rgba(123,45,63,0.15);border:1px solid rgba(212,167,106,0.3);border-radius:12px;padding:24px;margin:0 0 24px;">
        <p style="color:#d4a76a;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">🔮 My guidance</p>
        <p style="color:#e8d5c4;font-size:15px;line-height:1.7;margin:0;">${responseHtml}</p>
      </div>

      <p style="color:rgba(232,213,196,0.5);font-size:13px;margin:0;text-align:center;">
        Thank you for your trust. ✨<br>
        With light and kindness,<br>
        <strong style="color:#d4a76a;">Laura — Aura Intuitive</strong>
      </p>
    </div>

    <div style="border-top:1px solid rgba(123,45,63,0.3);padding:16px 24px;text-align:center;">
      <p style="color:rgba(232,213,196,0.3);font-size:11px;margin:0;">
        © 2026 Aura Intuitive — This is an automated email, please do not reply.
      </p>
    </div>
  </div>
</body>
</html>`;
}

/* ═══════════════════════════════════════════════════════
   START
   ═══════════════════════════════════════════════════════ */

app.listen(PORT, () => {
  console.log(`
  ✦ ═══════════════════════════════════════════ ✦
    Aura Intuitive — Server running
    → http://localhost:${PORT}
    → Admin: http://localhost:${PORT}/admin
  ✦ ═══════════════════════════════════════════ ✦
  `);
});
