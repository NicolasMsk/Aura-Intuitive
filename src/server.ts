/* ═══════════════════════════════════════════════════════
   AURA INTUITIVE — Server (TypeScript)
   Express + Stripe Webhooks + Supabase + Resend
   ═══════════════════════════════════════════════════════ */

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import cookieSession from 'cookie-session';
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

// Stripe webhook needs raw body — must be BEFORE express.json()
app.post(
  '/api/webhook',
  express.raw({ type: 'application/json' }),
  webhookHandler,
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cookieSession({
    name: 'aura_admin',
    keys: [process.env.ADMIN_PASSWORD!],
    maxAge: 24 * 60 * 60 * 1000, // 24h
    httpOnly: true,
    sameSite: 'lax',
  }),
);

app.use(express.static(path.join(__dirname, '..', 'public')));

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

    if (amountTotal >= 1000) {
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

/* ── 3. Submit question (POST /api/submit) ──────────── */

app.post('/api/submit', async (req: Request, res: Response): Promise<void> => {
  const { session_id, name, email, birthdate, person_concerned, message } = req.body as SubmitBody;

  if (!session_id || !name || !email || !message) {
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
      const service = amountTotal >= 1000 ? 'Consultation Ressenti' : 'Réponse Oui / Non';

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
      });

      if (insertError) {
        console.error('❌  Insert on submit:', insertError);
        res.status(500).json({ error: 'Erreur lors de l\'enregistrement.' });
        return;
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
    })
    .eq('stripe_session_id', session_id);

  if (updateError) {
    console.error('❌  Update error:', updateError);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement.' });
    return;
  }

  console.log(`📩  Question submitted for session ${session_id}`);
  res.json({ success: true });
});

/* ═══════════════════════════════════════════════════════
   TEST (à supprimer en production)
   ═══════════════════════════════════════════════════════ */

app.get('/test', async (_req: Request, res: Response): Promise<void> => {
  const fakeSessionId = 'test_' + Date.now();

  const { error } = await supabase.from('consultations').insert({
    stripe_session_id: fakeSessionId,
    service: 'Consultation Ressenti',
    amount: 10,
    status: 'paid',
    customer_email: 'test@test.com',
  });

  if (error) {
    console.error('❌  Test insert error:', error);
    res.status(500).json({ error: error.message });
    return;
  }

  console.log(`🧪  Test consultation created: ${fakeSessionId}`);
  res.redirect(`/form?session_id=${fakeSessionId}`);
});

/* ═══════════════════════════════════════════════════════
   ADMIN
   ═══════════════════════════════════════════════════════ */

/* ── Admin login ────────────────────────────────────── */

app.post('/api/admin/login', (req: Request, res: Response): void => {
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
    .select('status, amount')
    .in('status', ['submitted', 'answered']);

  if (error) {
    res.status(500).json({ error: 'Erreur base de données.' });
    return;
  }

  const all = data ?? [];
  const pending = all.filter(c => c.status === 'submitted').length;
  const answered = all.filter(c => c.status === 'answered').length;
  const revenue = all.reduce((sum, c) => sum + (c.amount || 0), 0);

  res.json({ total: all.length, pending, answered, revenue });
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
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: consultation.email,
      subject: `🔮 Votre guidance Aura Intuitive — ${consultation.service}`,
      html: buildResponseEmail(consultation as Consultation, response),
    });
    emailSent = true;
    console.log(`✨  Response sent + email delivered for consultation ${id}`);
  } catch (err: any) {
    console.error('⚠️  Email send failed (response saved anyway):', err.message);
  }

  res.json({
    success: true,
    emailSent,
    message: emailSent
      ? 'Réponse enregistrée et email envoyé !'
      : 'Réponse enregistrée ✅ mais l\'email n\'a pas pu être envoyé. Vous pouvez copier la réponse et l\'envoyer manuellement.',
  });
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
   EMAIL TEMPLATE
   ═══════════════════════════════════════════════════════ */

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
        <strong style="color:#d4a76a;">Sarah — Aura Intuitive</strong>
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
