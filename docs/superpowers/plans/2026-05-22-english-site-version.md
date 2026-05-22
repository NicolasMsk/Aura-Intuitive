# English Site Version — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a fully translated English version of Aura Intuitive at `/en/*` with language switcher, hreflang SEO, and English email templates auto-selected based on consultation language.

**Architecture:** Static HTML duplication under `public/en/` (no templating engine, no client-side i18n). Minimal backend additions: 1 DB column (`lang`), 1 new Express route (`/en/form`), 3 new email template functions. Language is passed via URL query param `lang=en` from Stripe redirect → stored in DB → drives email template selection.

**Tech Stack:** Express + TypeScript, Supabase (Postgres), Resend (emails), Stripe (Payment Links + webhooks), static HTML/CSS/JS.

**Reference spec:** [`docs/superpowers/specs/2026-05-22-english-site-version-design.md`](../specs/2026-05-22-english-site-version-design.md)

---

## Service Name Mapping (used throughout)

| FR (in DB) | EN (in emails / UI) |
|---|---|
| `Consultation Ressenti` | `Intuitive Reading` |
| `Réponse Oui / Non` | `Yes / No Answer` |

The `service` column in DB stays in French (it's an internal identifier). Email templates map to EN at render time.

## Blog Slug Mapping (FR → EN)

| FR file | EN file |
|---|---|
| `voyance-1-euro-serieuse.html` | `cheap-psychic-reading-1-euro.html` |
| `consultation-voyance-pas-chere.html` | `affordable-psychic-consultation.html` |
| `voyance-gratuite-en-ligne-ce-quil-faut-savoir.html` | `free-online-psychic-reading-guide.html` |
| `voyance-gratuite-vs-payante-difference.html` | `free-vs-paid-psychic-reading.html` |
| `voyance-sans-cb-sans-abonnement.html` | `psychic-reading-without-credit-card.html` |
| `voyance-par-email-avantages.html` | `psychic-reading-by-email-benefits.html` |
| `comment-formuler-question-voyante.html` | `how-to-ask-a-psychic-question.html` |
| `premiere-consultation-voyance-en-ligne.html` | `first-online-psychic-reading.html` |
| `reponse-oui-non-voyance-fonctionnement.html` | `yes-no-psychic-reading-how-it-works.html` |
| `developper-son-intuition-exercices.html` | `develop-your-intuition-exercises.html` |
| `signes-il-pense-a-vous.html` | `signs-he-is-thinking-of-you.html` |
| `mon-ex-va-t-il-revenir-voyance.html` | `will-my-ex-come-back-psychic.html` |
| `mon-ex-a-refait-sa-vie-voyance.html` | `my-ex-moved-on-psychic-reading.html` |
| `rever-de-son-ex-signification.html` | `dreaming-of-your-ex-meaning.html` |
| `flamme-jumelle-ame-soeur-difference.html` | `twin-flame-vs-soulmate.html` |
| `voyance-amoureuse-comprendre-sentiments.html` | `love-psychic-understanding-feelings.html` |
| `retrouver-amour-celibataire-voyance.html` | `finding-love-as-a-single-psychic.html` |
| `voyance-argent-finances.html` | `money-and-finance-psychic.html` |
| `voyance-travail-carriere-reconversion.html` | `career-and-work-psychic-reading.html` |

(19 articles total — `blog/index.html` is the listing page, handled separately.)

---

## Task 1: DB Migration — Add `lang` column

**Files:**
- Modify: `schema.sql`
- Manual action: run SQL in Supabase SQL Editor

- [ ] **Step 1: Edit `schema.sql` — append the migration**

Append at the bottom of `schema.sql`:

```sql
-- 2026-05-22 — Add language column for EN/FR site support
ALTER TABLE consultations
  ADD COLUMN IF NOT EXISTS lang TEXT NOT NULL DEFAULT 'fr'
  CHECK (lang IN ('fr', 'en'));
```

- [ ] **Step 2: Run the migration in Supabase**

In Supabase Dashboard → SQL Editor → paste the snippet above → Run.

Verify:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'consultations' AND column_name = 'lang';
```
Expected: one row with `lang | text | 'fr'::text`.

- [ ] **Step 3: Commit**

```bash
git add schema.sql
git commit -m "feat(db): add lang column to consultations table"
```

---

## Task 2: Types — Add `lang` to `Consultation` and `SubmitBody`

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Read current `src/types.ts` to identify exact shape**

- [ ] **Step 2: Add `lang` field to `Consultation` interface and `SubmitBody` interface**

Add to `Consultation`:
```typescript
lang?: 'fr' | 'en'; // defaults to 'fr' in DB
```

Add to `SubmitBody`:
```typescript
lang?: 'fr' | 'en';
```

- [ ] **Step 3: TypeScript compile check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/types.ts
git commit -m "feat(types): add lang field to Consultation and SubmitBody"
```

---

## Task 3: EN Email Templates — Add 3 new functions to `server.ts`

**Files:**
- Modify: `src/server.ts` (append in EMAIL TEMPLATES section, before "START")

- [ ] **Step 1: Add `buildConfirmationEmailOuiNonEN` function**

Insert after `buildConfirmationEmailOuiNon`:

```typescript
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
```

- [ ] **Step 2: Add `buildConfirmationEmailRessentiEN` function**

Insert after `buildConfirmationEmailRessenti`:

```typescript
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
```

- [ ] **Step 3: Add `buildResponseEmailEN` function**

Insert after `buildResponseEmail`:

```typescript
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
```

- [ ] **Step 4: TypeScript compile check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/server.ts
git commit -m "feat(email): add EN templates for confirmation and response emails"
```

---

## Task 4: Backend — `/en/form` route + `lang` handling in `/api/submit`

**Files:**
- Modify: `src/server.ts` — submit handler (~lines 225-370), add new `/en/form` route, update subject lines and email picker

- [ ] **Step 1: Add `/en/form` route**

Insert after the existing `/form` route (around line 221):

```typescript
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
```

- [ ] **Step 2: Update `/api/submit` to accept and store `lang`**

In `src/server.ts`, find the destructuring on line ~226:

```typescript
const { session_id, name, email, birthdate, person_concerned, message } = req.body as SubmitBody;
```

Replace with:
```typescript
const { session_id, name, email, birthdate, person_concerned, message, lang } = req.body as SubmitBody;
const normalizedLang: 'fr' | 'en' = lang === 'en' ? 'en' : 'fr';
```

- [ ] **Step 3: Pass `lang` into both `insert` and `update` paths**

In the insert block (around line 252, inside the catch where the webhook was delayed), add `lang: normalizedLang,` to the inserted object.

In the update block (around line 319), add `lang: normalizedLang,` to the updated object.

- [ ] **Step 4: Update confirmation email selection logic**

There are TWO places where confirmation emails are sent (insert path and update path). Replace BOTH email-sending blocks (where `buildConfirmationEmailRessenti` / `buildConfirmationEmailOuiNon` are called) with a unified language-aware version.

**Insert path** (around line 274–284) — replace:
```typescript
const emailHtml = service === 'Consultation Ressenti'
  ? buildConfirmationEmailRessenti(name)
  : buildConfirmationEmailOuiNon(name);
await resend.emails.send({
  from: EMAIL_FROM,
  to: email,
  subject: service === 'Consultation Ressenti'
    ? '✨ Votre Consultation Ressenti a bien été reçue — Aura Intuitive'
    : '✨ Votre Réponse Oui / Non a bien été reçue — Aura Intuitive',
  html: emailHtml,
});
```

With:
```typescript
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
```

**Update path** (around line 337–349) — same replacement pattern, using `serviceName` instead of `service`:
```typescript
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
```

- [ ] **Step 5: Update `/api/admin/respond` to send EN response email when applicable**

Find the response email send (around line 541):
```typescript
const emailResult = await resend.emails.send({
  from: EMAIL_FROM,
  to: consultation.email,
  subject: `🔮 Votre guidance Aura Intuitive — ${consultation.service}`,
  html: buildResponseEmail(consultation as Consultation, response),
});
```

Replace with:
```typescript
const c = consultation as Consultation;
const isEN = c.lang === 'en';
const serviceEN = c.service === 'Consultation Ressenti' ? 'Intuitive Reading' : 'Yes / No Answer';
const emailResult = await resend.emails.send({
  from: EMAIL_FROM,
  to: c.email,
  subject: isEN
    ? `🔮 Your Aura Intuitive guidance — ${serviceEN}`
    : `🔮 Votre guidance Aura Intuitive — ${c.service}`,
  html: isEN
    ? buildResponseEmailEN(c, response)
    : buildResponseEmail(c, response),
});
```

- [ ] **Step 6: TypeScript compile check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/server.ts
git commit -m "feat(server): handle lang in submit/respond + add /en/form route"
```

---

## Task 5: Landing page EN — `public/en/index.html`

**Files:**
- Read: `public/index.html` (reference, FR source)
- Create: `public/en/index.html`

- [ ] **Step 1: Read `public/index.html` fully**

Note all sections: hero, services, testimonials, FAQ, footer. Note all Stripe Payment Link URLs (these stay the same for now — will be replaced manually with EN Payment Links in Task 17).

- [ ] **Step 2: Create `public/en/index.html` — translated copy**

Duplicate the structure. Translate all visible text into English:
- Hero headline, subheadline, CTA buttons
- Service descriptions (Intuitive Reading, Yes / No Answer)
- Pricing block: keep `€` (`€10`, `€1`)
- Testimonials (translate naturally — keep first names as-is)
- FAQ section
- Footer text

**Adjustments specific to this file:**
- `<html lang="fr">` → `<html lang="en">`
- `<title>` → EN equivalent (~60 chars, include "Aura Intuitive" + main keyword like "Psychic Reading")
- `<meta name="description">` → EN, ~155 chars
- Stripe Payment Link `href`s → leave the FR ones in place with a `data-en-todo` comment; will be swapped in Task 17
- All internal links must point to `/en/*` equivalents: `/a-propos.html` → `/en/about.html`, `/mentions-legales.html` → `/en/legal.html`, `/blog/` → `/en/blog/`
- CSS: keep `<link rel="stylesheet" href="/style.css?v=6">` (same file)
- JS: keep `<script src="/script.js?v=5">` (same file)

**Add hreflang block in `<head>`:**
```html
<link rel="alternate" hreflang="fr" href="https://www.auraintuitive.fr/">
<link rel="alternate" hreflang="en" href="https://www.auraintuitive.fr/en/">
<link rel="alternate" hreflang="x-default" href="https://www.auraintuitive.fr/">
```

**Add language switcher in the header (top of page), styled inline so it works without CSS changes:**
```html
<div class="lang-switcher" style="position:absolute;top:16px;right:16px;z-index:100;font-size:13px;">
  <a href="/" style="color:rgba(255,255,255,0.6);text-decoration:none;margin-right:8px;">🇫🇷 FR</a>
  <span style="color:rgba(255,255,255,0.3);">|</span>
  <a href="/en/" style="color:#d4a76a;text-decoration:none;font-weight:bold;margin-left:8px;">🇬🇧 EN</a>
</div>
```

(The active language is gold, the other muted.)

- [ ] **Step 3: Visual verification**

```bash
npm run dev
```
Open `http://localhost:3000/en/` in a browser. Verify:
- Page loads with EN content
- All sections render correctly with existing CSS
- Switcher in top-right shows FR | **EN** (EN highlighted)
- Clicking FR goes to `/`
- No console errors

- [ ] **Step 4: Commit**

```bash
git add public/en/index.html
git commit -m "feat(en): add English landing page"
```

---

## Task 6: About page EN — `public/en/about.html`

**Files:**
- Read: `public/a-propos.html`
- Create: `public/en/about.html`

- [ ] **Step 1: Read `public/a-propos.html`**

- [ ] **Step 2: Translate and save as `public/en/about.html`**

Same rules as Task 5:
- `<html lang="en">`
- EN `<title>` and `<meta description>`
- All internal links → `/en/*`
- Add hreflang block:
  ```html
  <link rel="alternate" hreflang="fr" href="https://www.auraintuitive.fr/a-propos.html">
  <link rel="alternate" hreflang="en" href="https://www.auraintuitive.fr/en/about.html">
  <link rel="alternate" hreflang="x-default" href="https://www.auraintuitive.fr/">
  ```
- Add the same language switcher block as in Task 5
- Translate Laura's story / bio naturally, preserve spiritual / warm tone

- [ ] **Step 3: Visual verification**

Browser: `http://localhost:3000/en/about.html`. Verify content, switcher, links.

- [ ] **Step 4: Commit**

```bash
git add public/en/about.html
git commit -m "feat(en): add English about page"
```

---

## Task 7: Legal page EN — `public/en/legal.html`

**Files:**
- Read: `public/mentions-legales.html`
- Create: `public/en/legal.html`

- [ ] **Step 1: Read `public/mentions-legales.html`**

- [ ] **Step 2: Translate as `public/en/legal.html`**

⚠️ Legal pages have specific French regulations (RGPD, mentions légales, hébergeur). The EN version should:
- Keep the same factual info (company name, address, email, hosting provider)
- Translate the framing labels (e.g., "Mentions légales" → "Legal Notice", "Hébergeur" → "Hosting Provider", "Données personnelles" → "Personal Data (GDPR)")
- Translate the GDPR / cookies sections to plain English (the underlying obligations remain — French law applies, GDPR covers EU citizens regardless of language)

Apply the same conventions: `<html lang="en">`, hreflang block (`fr` → `/mentions-legales.html`, `en` → `/en/legal.html`), switcher, internal links to `/en/*`.

- [ ] **Step 3: Visual verification**

- [ ] **Step 4: Commit**

```bash
git add public/en/legal.html
git commit -m "feat(en): add English legal notice page"
```

---

## Task 8: Form page EN — `public/en/form.html`

**Files:**
- Read: `public/form.html`
- Create: `public/en/form.html`

- [ ] **Step 1: Read `public/form.html`**

Note the form field names, validation messages, and the submission JS (likely POSTs to `/api/submit`).

- [ ] **Step 2: Translate as `public/en/form.html`**

Standard rules + this critical addition: **add a hidden input** to mark the language:

```html
<input type="hidden" name="lang" value="en">
```

Place it inside the `<form>` element. The submission JS already sends all fields to `/api/submit` as JSON, so `lang` will be included automatically. Verify in the JS that all form fields are serialized (if it picks fields by name, the hidden input will be included; if it picks specific names only, ADD `lang` to the payload).

If the submission is done via `JSON.stringify` from a manual object, edit the JS like:
```javascript
const payload = {
  session_id: sessionId,
  name: form.name.value,
  email: form.email.value,
  birthdate: form.birthdate.value,
  person_concerned: form.person_concerned.value,
  message: form.message.value,
  lang: 'en',  // ← add this line
};
```

Translate all labels, placeholders, validation messages, headings, and any inline help text.

hreflang block for form pages:
```html
<link rel="alternate" hreflang="fr" href="https://www.auraintuitive.fr/form.html">
<link rel="alternate" hreflang="en" href="https://www.auraintuitive.fr/en/form.html">
```
(No `x-default` here since form pages aren't entry points.)

- [ ] **Step 3: Also update `public/form.html` (FR) to send `lang: 'fr'`**

Open `public/form.html`. Find the submission payload (similar JS block). Add `lang: 'fr'` to the JSON body so the FR form explicitly sends its language too. This makes the backend behavior consistent and unambiguous.

If using a hidden input approach in EN form, mirror it in FR:
```html
<input type="hidden" name="lang" value="fr">
```

- [ ] **Step 4: Visual + functional verification**

```bash
npm run dev
```
- Browser: `http://localhost:3000/en/form.html?session_id=test_dummy` — should redirect to `/en/#services` (no real session). Browse to `/en/form.html` directly to inspect the form rendering.
- Inspect DOM: confirm hidden `lang=en` input is present.

For full E2E, create a test paid session in Stripe test mode, complete payment, observe redirect to `/en/form.html?session_id=...&lang=en`, submit form, check Supabase row has `lang='en'`.

- [ ] **Step 5: Commit**

```bash
git add public/form.html public/en/form.html
git commit -m "feat(en): add English form page + send lang in both forms"
```

---

## Task 9: Thank-you page EN — `public/en/thank-you.html`

**Files:**
- Read: `public/merci.html`
- Create: `public/en/thank-you.html`

- [ ] **Step 1: Read `public/merci.html`**

- [ ] **Step 2: Translate as `public/en/thank-you.html`**

Standard rules. The page is typically shown after form submission ("Merci, votre question a bien été reçue, vous recevrez une réponse sous 24h").

hreflang:
```html
<link rel="alternate" hreflang="fr" href="https://www.auraintuitive.fr/merci.html">
<link rel="alternate" hreflang="en" href="https://www.auraintuitive.fr/en/thank-you.html">
```

⚠️ **Important** — if `public/form.html` JS redirects to `/merci.html` after submission, the EN form must redirect to `/en/thank-you.html`. Check the JS in `public/en/form.html` (created in Task 8) and update the redirect target.

- [ ] **Step 3: Visual verification**

Browser: `http://localhost:3000/en/thank-you.html`.

- [ ] **Step 4: Commit**

```bash
git add public/en/thank-you.html public/en/form.html
git commit -m "feat(en): add English thank-you page + redirect EN form to it"
```

---

## Task 10: Already-submitted page EN — `public/en/already-submitted.html`

**Files:**
- Read: `public/already-submitted.html`
- Create: `public/en/already-submitted.html`

- [ ] **Step 1: Read `public/already-submitted.html`**

- [ ] **Step 2: Translate as `public/en/already-submitted.html`**

Page shown when a user revisits the form for a consultation that's already submitted. Same conventions.

hreflang:
```html
<link rel="alternate" hreflang="fr" href="https://www.auraintuitive.fr/already-submitted.html">
<link rel="alternate" hreflang="en" href="https://www.auraintuitive.fr/en/already-submitted.html">
```

- [ ] **Step 3: Visual verification**

- [ ] **Step 4: Commit**

```bash
git add public/en/already-submitted.html
git commit -m "feat(en): add English already-submitted page"
```

---

## Task 11: FR pages — Add switcher + hreflang to existing French pages

**Files:**
- Modify: `public/index.html`, `public/a-propos.html`, `public/mentions-legales.html`, `public/form.html`, `public/merci.html`, `public/already-submitted.html`, `public/blog/index.html`

- [ ] **Step 1: Add the language switcher block to each FR page**

The FR page has FR active (gold) and EN muted:
```html
<div class="lang-switcher" style="position:absolute;top:16px;right:16px;z-index:100;font-size:13px;">
  <a href="/" style="color:#d4a76a;text-decoration:none;font-weight:bold;margin-right:8px;">🇫🇷 FR</a>
  <span style="color:rgba(255,255,255,0.3);">|</span>
  <a href="/en/" style="color:rgba(255,255,255,0.6);text-decoration:none;margin-left:8px;">🇬🇧 EN</a>
</div>
```

For each page, the **target** of the EN link is the matching EN URL:

| FR page | EN target |
|---|---|
| `index.html` | `/en/` |
| `a-propos.html` | `/en/about.html` |
| `mentions-legales.html` | `/en/legal.html` |
| `form.html` | `/en/form.html` |
| `merci.html` | `/en/thank-you.html` |
| `already-submitted.html` | `/en/already-submitted.html` |
| `blog/index.html` | `/en/blog/` |

- [ ] **Step 2: Add hreflang block to each FR page**

Generic template (replace URLs per page):
```html
<link rel="alternate" hreflang="fr" href="https://www.auraintuitive.fr/<FR_PATH>">
<link rel="alternate" hreflang="en" href="https://www.auraintuitive.fr/en/<EN_PATH>">
<link rel="alternate" hreflang="x-default" href="https://www.auraintuitive.fr/">
```

- [ ] **Step 3: Visual verification on all FR pages**

Cycle through each FR page in browser, confirm switcher present and points to correct EN target. Clicking EN should land on the corresponding EN page.

- [ ] **Step 4: Commit**

```bash
git add public/index.html public/a-propos.html public/mentions-legales.html public/form.html public/merci.html public/already-submitted.html public/blog/index.html
git commit -m "feat(i18n): add language switcher + hreflang to FR pages"
```

---

## Task 12: Blog index EN — `public/en/blog/index.html`

**Files:**
- Read: `public/blog/index.html`
- Create: `public/en/blog/index.html`

- [ ] **Step 1: Read `public/blog/index.html`**

This is the blog listing page (titles, excerpts, links to each article).

- [ ] **Step 2: Translate as `public/en/blog/index.html`**

Standard conventions. Update all article links from `/blog/<fr-slug>.html` to `/en/blog/<en-slug>.html` using the mapping table at the top of this plan.

hreflang:
```html
<link rel="alternate" hreflang="fr" href="https://www.auraintuitive.fr/blog/">
<link rel="alternate" hreflang="en" href="https://www.auraintuitive.fr/en/blog/">
<link rel="alternate" hreflang="x-default" href="https://www.auraintuitive.fr/">
```

- [ ] **Step 3: Visual verification**

Browser: `http://localhost:3000/en/blog/`. Verify all 19 article links display (they'll 404 until Tasks 13-15 create the article files — that's expected at this stage).

- [ ] **Step 4: Commit**

```bash
git add public/en/blog/index.html
git commit -m "feat(en): add English blog index"
```

---

## Task 13: Blog articles batch 1 (7 articles — informational / pricing)

**Files (read FR → create EN, see slug mapping at top):**
- `voyance-1-euro-serieuse.html` → `cheap-psychic-reading-1-euro.html`
- `consultation-voyance-pas-chere.html` → `affordable-psychic-consultation.html`
- `voyance-gratuite-en-ligne-ce-quil-faut-savoir.html` → `free-online-psychic-reading-guide.html`
- `voyance-gratuite-vs-payante-difference.html` → `free-vs-paid-psychic-reading.html`
- `voyance-sans-cb-sans-abonnement.html` → `psychic-reading-without-credit-card.html`
- `voyance-par-email-avantages.html` → `psychic-reading-by-email-benefits.html`
- `reponse-oui-non-voyance-fonctionnement.html` → `yes-no-psychic-reading-how-it-works.html`

- [ ] **Step 1: For each article above, read the FR source from `public/blog/`**

- [ ] **Step 2: Create the EN equivalent in `public/en/blog/`**

For every article:
- `<html lang="en">`
- EN `<title>` (~60 chars, SEO-optimized)
- EN `<meta description>` (~155 chars)
- Translate body content fully — headings, paragraphs, lists, FAQs, callouts
- Internal links: point to `/en/blog/<en-slug>.html` for blog refs, `/en/` for landing CTAs
- Add language switcher (same block as Task 5; EN active)
- Add hreflang block:
  ```html
  <link rel="alternate" hreflang="fr" href="https://www.auraintuitive.fr/blog/<fr-slug>.html">
  <link rel="alternate" hreflang="en" href="https://www.auraintuitive.fr/en/blog/<en-slug>.html">
  ```
- Update FR source: add switcher + hreflang to point to EN equivalent

- [ ] **Step 3: Visual verification — spot-check 2 articles in browser**

- [ ] **Step 4: Commit**

```bash
git add public/blog/ public/en/blog/
git commit -m "feat(en): translate blog articles batch 1 (7 articles)"
```

---

## Task 14: Blog articles batch 2 (6 articles — relationships / ex)

**Files:**
- `comment-formuler-question-voyante.html` → `how-to-ask-a-psychic-question.html`
- `premiere-consultation-voyance-en-ligne.html` → `first-online-psychic-reading.html`
- `developper-son-intuition-exercices.html` → `develop-your-intuition-exercises.html`
- `signes-il-pense-a-vous.html` → `signs-he-is-thinking-of-you.html`
- `mon-ex-va-t-il-revenir-voyance.html` → `will-my-ex-come-back-psychic.html`
- `mon-ex-a-refait-sa-vie-voyance.html` → `my-ex-moved-on-psychic-reading.html`

Same procedure as Task 13.

- [ ] **Step 1: Read each FR source**
- [ ] **Step 2: Create EN equivalent, with switcher, hreflang, EN internal links**
- [ ] **Step 3: Update FR sources with switcher + hreflang**
- [ ] **Step 4: Visual spot-check**
- [ ] **Step 5: Commit**

```bash
git add public/blog/ public/en/blog/
git commit -m "feat(en): translate blog articles batch 2 (6 articles)"
```

---

## Task 15: Blog articles batch 3 (6 articles — love / career / money)

**Files:**
- `rever-de-son-ex-signification.html` → `dreaming-of-your-ex-meaning.html`
- `flamme-jumelle-ame-soeur-difference.html` → `twin-flame-vs-soulmate.html`
- `voyance-amoureuse-comprendre-sentiments.html` → `love-psychic-understanding-feelings.html`
- `retrouver-amour-celibataire-voyance.html` → `finding-love-as-a-single-psychic.html`
- `voyance-argent-finances.html` → `money-and-finance-psychic.html`
- `voyance-travail-carriere-reconversion.html` → `career-and-work-psychic-reading.html`

Same procedure as Task 13.

- [ ] **Step 1: Read each FR source**
- [ ] **Step 2: Create EN equivalent, with switcher, hreflang, EN internal links**
- [ ] **Step 3: Update FR sources with switcher + hreflang**
- [ ] **Step 4: Visual spot-check**
- [ ] **Step 5: Commit**

```bash
git add public/blog/ public/en/blog/
git commit -m "feat(en): translate blog articles batch 3 (6 articles)"
```

---

## Task 16: SEO files — `sitemap.xml` and `llms.txt`

**Files:**
- Modify: `public/sitemap.xml`
- Modify: `public/llms.txt`

- [ ] **Step 1: Update `public/sitemap.xml`**

Add entries for all EN pages with hreflang alternates. Example entry structure:

```xml
<url>
  <loc>https://www.auraintuitive.fr/en/</loc>
  <lastmod>2026-05-22</lastmod>
  <priority>1.0</priority>
  <xhtml:link rel="alternate" hreflang="fr" href="https://www.auraintuitive.fr/" />
  <xhtml:link rel="alternate" hreflang="en" href="https://www.auraintuitive.fr/en/" />
  <xhtml:link rel="alternate" hreflang="x-default" href="https://www.auraintuitive.fr/" />
</url>
```

Make sure the `<urlset>` element declares the xhtml namespace:
```xml
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
```

Add corresponding `<xhtml:link>` entries to the **existing FR `<url>` entries** as well (FR → EN alternates).

Add entries for:
- `/en/` (landing)
- `/en/about.html`
- `/en/legal.html`
- `/en/blog/`
- 19 EN blog article URLs

Do NOT add `form.html`, `thank-you.html`, `already-submitted.html` (post-payment pages, not indexable).

- [ ] **Step 2: Update `public/llms.txt`**

Append a new section at the end:

```
## English version

Aura Intuitive is also available in English at:

- Landing: https://www.auraintuitive.fr/en/
- About: https://www.auraintuitive.fr/en/about.html
- Legal notice: https://www.auraintuitive.fr/en/legal.html
- Blog: https://www.auraintuitive.fr/en/blog/

Services offered (same pricing as FR, payment in EUR via Stripe):
- Intuitive Reading — €10 — detailed personalized spiritual guidance, answered within 24h
- Yes / No Answer — €1 — short intuitive answer to a single yes/no question, answered within 24h
```

- [ ] **Step 3: Verify XML validity**

```bash
npx -y xmllint --noout public/sitemap.xml
```
Expected: no output (valid XML). If `xmllint` not available, paste contents into https://www.xmlvalidation.com/ as fallback.

- [ ] **Step 4: Commit**

```bash
git add public/sitemap.xml public/llms.txt
git commit -m "feat(seo): update sitemap and llms.txt with EN URLs and hreflang"
```

---

## Task 17: Stripe Payment Links — manual user action + EN landing URL updates

**Files:**
- Modify: `public/en/index.html` (replace placeholder Stripe URLs)
- Manual action: Stripe Dashboard

- [ ] **Step 1: User action — Clone Payment Links in Stripe Dashboard**

For each existing FR Payment Link:
1. Stripe Dashboard → Payment Links → `...` menu → **Duplicate**
2. Rename clone with "— EN" suffix (e.g., `Consultation Ressenti — EN`)
3. Open the clone → **After payment** → **Redirect to your website** →
   ```
   https://www.auraintuitive.fr/en/form.html?session_id={CHECKOUT_SESSION_ID}&lang=en
   ```
   (`{CHECKOUT_SESSION_ID}` is a Stripe placeholder — paste literally.)
4. Save and copy the resulting Payment Link URL.

Do this for **both** services (Consultation Ressenti and Réponse Oui / Non). Record the two new EN Payment Link URLs.

- [ ] **Step 2: Replace placeholder Stripe URLs in `public/en/index.html`**

Open `public/en/index.html`. Find the buttons currently linking to the FR Payment Links (left as-is in Task 5). Replace each with the corresponding EN Payment Link URL from Step 1.

- [ ] **Step 3: Verify Stripe redirect**

In Stripe test mode (use a test Payment Link card `4242 4242 4242 4242`), click an EN Payment Link button, complete payment, verify the redirect lands on `https://your-deployed-domain/en/form.html?session_id=cs_test_...&lang=en`.

- [ ] **Step 4: Commit**

```bash
git add public/en/index.html
git commit -m "feat(en): wire EN Payment Links into landing page"
```

---

## Task 18: Build + dev smoke test

**Files:** none (verification only)

- [ ] **Step 1: TypeScript build**

```bash
npm run build
```
Expected: clean compile, files in `dist/`.

- [ ] **Step 2: Start dev server**

```bash
npm run dev
```

- [ ] **Step 3: Manual click-through verification**

In browser, visit each page and confirm:

| URL | Verify |
|---|---|
| `http://localhost:3000/` | FR landing loads, switcher present (FR active) |
| `http://localhost:3000/en/` | EN landing loads, switcher present (EN active) |
| `http://localhost:3000/en/about.html` | EN about page, switcher works |
| `http://localhost:3000/en/legal.html` | EN legal page |
| `http://localhost:3000/en/blog/` | EN blog index, 19 article links work |
| 2 random EN articles | Loads, content in English |
| `http://localhost:3000/en/form.html` | Renders form (will redirect without session_id — that's correct) |
| `http://localhost:3000/sitemap.xml` | Valid XML, includes EN URLs with hreflang |
| `http://localhost:3000/llms.txt` | Contains EN section |

Click the switcher FR↔EN on at least 3 different pages — confirms bidirectional navigation.

- [ ] **Step 4: Console check**

In each page tested, open browser DevTools → Console. Confirm no JS errors. Check Network tab → no 404s on stylesheets, scripts, or images.

---

## Task 19: End-to-end payment flow verification (Stripe test mode)

**Files:** none (verification only)

- [ ] **Step 1: Deploy to staging or run locally with Stripe test mode + ngrok**

If testing locally, expose port 3000 via `ngrok http 3000` and configure the EN Payment Link to redirect to `https://<ngrok-id>.ngrok.io/en/form.html?...` (temporary edit).

- [ ] **Step 2: Complete an EN test purchase**

- Visit `/en/` → click "Order" on Yes / No Answer (€1)
- Complete Stripe checkout with test card `4242 4242 4242 4242`
- Confirm redirect to `/en/form.html?session_id=cs_test_...&lang=en`
- Fill the form in English, submit

- [ ] **Step 3: Verify DB and emails**

- Supabase → `consultations` table → confirm new row with `lang='en'`, status `'submitted'`, message in English
- Inbox of test email → confirm confirmation email arrived **in English** with EN subject line
- Admin inbox → confirm admin alert email arrived (will be FR — that's intended)

- [ ] **Step 4: Test admin response flow**

- Log in to `/admin`
- Open the new EN consultation
- Type a reply in English → Send
- Confirm client receives response email **in English** (subject + body)

- [ ] **Step 5: Repeat with an FR purchase to confirm no regression**

Same flow on FR side. Confirm:
- DB row has `lang='fr'`
- All emails in French (unchanged from before)

- [ ] **Step 6: Final commit (if any fixes were needed)**

```bash
git status
# If fixes:
git add <files>
git commit -m "fix(en): adjustments after E2E verification"
```

---

## Plan Self-Review

**Spec coverage check (against [spec doc](../specs/2026-05-22-english-site-version-design.md)):**

| Spec requirement | Covered by |
|---|---|
| `public/en/` structure with EN slugs | Tasks 5–10, 12–15 |
| FR/EN switcher on all public pages | Tasks 5–15 (added to EN pages) + Task 11 (added to FR pages) |
| hreflang on all pages | Tasks 5–15 + Task 11 |
| Sitemap updated with alternates | Task 16 |
| llms.txt enriched | Task 16 |
| `schema.sql` — `lang` column | Task 1 |
| `server.ts` — accept lang, route /en/form, EN emails | Tasks 3, 4 |
| `admin.html` not modified | Confirmed — no task touches it |
| 4 email templates (2 FR existing + 2 EN new for confirmations, plus EN response = 3 new total) | Task 3 |
| Stripe Payment Links cloned + wired | Task 17 |
| E2E verification | Tasks 18, 19 |

**Type consistency check:**
- `lang: 'fr' | 'en'` used consistently in types.ts (Task 2), server.ts (Task 4), DB schema (Task 1)
- Email function names follow pattern `<purpose>EN` suffix (Task 3)
- Service mapping table at the top is referenced from email functions (Task 3) and response logic (Task 4)

**No placeholders:** spot-checked — all task steps contain concrete code or concrete actions. The 19 blog article translations are described generically (one task per batch) because the procedure is identical and the content varies per file; that's an acceptable batching, not a placeholder.

**Scope:** plan is focused on a single deliverable (EN site version). No decomposition needed.

---

## Execution Handoff

**Plan complete and saved to** `docs/superpowers/plans/2026-05-22-english-site-version.md`.

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Good for the high volume of HTML translations (each blog batch can be its own subagent).

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints. Heavier on this conversation's context.

Which approach?
