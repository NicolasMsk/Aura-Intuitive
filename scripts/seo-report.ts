/* ════════════════════════════════════════════════════
   Aura Intuitive — SEO Report (GSC + GA4, read-only)
   Run: npx tsx scripts/seo-report.ts
   Auth: credentials/service_account.json (gitignored)
   ════════════════════════════════════════════════════ */

import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SA = JSON.parse(readFileSync(path.join(__dirname, '..', 'credentials', 'service_account.json'), 'utf8'));
const GA4_PROPERTY = '524913327';
const GSC_CANDIDATES = ['sc-domain:auraintuitive.fr', 'https://www.auraintuitive.fr/'];

const b64url = (s: Buffer | string) => Buffer.from(s).toString('base64url');

async function getAccessToken(scopes: string[]): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: SA.client_email,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(SA.private_key, 'base64url');
  const jwt = `${header}.${claims}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  });
  const json = await res.json() as any;
  if (!json.access_token) throw new Error(`Token error: ${JSON.stringify(json)}`);
  return json.access_token;
}

const sec = (t: string) => console.log('\n' + '═'.repeat(64) + '\n  ' + t + '\n' + '═'.repeat(64));

async function gscQuery(token: string, site: string, body: object) {
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );
  return { status: res.status, json: await res.json() as any };
}

async function main() {
  const days = 90;
  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);

  /* ── 1. GSC ────────────────────────────────────────── */
  sec(`1/3 — SEARCH CONSOLE (${start} → ${end})`);
  const gscToken = await getAccessToken(['https://www.googleapis.com/auth/webmasters.readonly']);

  let site: string | null = null;
  for (const candidate of GSC_CANDIDATES) {
    const probe = await gscQuery(gscToken, candidate, { startDate: start, endDate: end, rowLimit: 1 });
    if (probe.status === 200) { site = candidate; break; }
    console.log(`  (${candidate} → ${probe.status} ${probe.json?.error?.message ?? ''})`);
  }

  if (!site) {
    console.log('❌ GSC : accès refusé sur les deux formats de propriété.');
    console.log('   → Vérifier que chess-398@city-baddies... est bien ajouté dans GSC.');
  } else {
    console.log(`✅ GSC OK — propriété: ${site}\n`);

    const topQueries = await gscQuery(gscToken, site, {
      startDate: start, endDate: end, dimensions: ['query'], rowLimit: 25,
    });
    console.log('── TOP 25 REQUÊTES ──');
    console.log('clics | impr | CTR | pos | requête');
    (topQueries.json.rows ?? []).forEach((r: any) =>
      console.log(`${String(r.clicks).padStart(5)} | ${String(r.impressions).padStart(4)} | ${(r.ctr * 100).toFixed(1).padStart(4)}% | ${r.position.toFixed(1).padStart(5)} | ${r.keys[0]}`));

    const topPages = await gscQuery(gscToken, site, {
      startDate: start, endDate: end, dimensions: ['page'], rowLimit: 20,
    });
    console.log('\n── TOP 20 PAGES ──');
    console.log('clics | impr | pos | page');
    (topPages.json.rows ?? []).forEach((r: any) =>
      console.log(`${String(r.clicks).padStart(5)} | ${String(r.impressions).padStart(4)} | ${r.position.toFixed(1).padStart(5)} | ${r.keys[0].replace('https://www.auraintuitive.fr', '')}`));

    // Requêtes proches du top 10 (position 8-15, impressions > 10) = quick wins
    const quickWins = (topQueries.json.rows ?? []).filter((r: any) => r.position >= 8 && r.position <= 15 && r.impressions >= 10);
    if (quickWins.length) {
      console.log('\n── 🎯 QUICK WINS (position 8-15, à pousser en top 10) ──');
      quickWins.forEach((r: any) => console.log(`  pos ${r.position.toFixed(1)} | ${r.impressions} impr | ${r.keys[0]}`));
    }
  }

  /* ── 2. GA4 ────────────────────────────────────────── */
  sec(`2/3 — GA4 propriété ${GA4_PROPERTY} (30 derniers jours)`);
  const gaToken = await getAccessToken(['https://www.googleapis.com/auth/analytics.readonly']);

  const ga = async (body: object) => {
    const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY}:runReport`, {
      method: 'POST', headers: { Authorization: `Bearer ${gaToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    return { status: res.status, json: await res.json() as any };
  };

  const channels = await ga({
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'sessionDefaultChannelGroup' }],
    metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
  });

  if (channels.status !== 200) {
    console.log(`❌ GA4 : ${channels.status} — ${channels.json?.error?.message}`);
    console.log('   → Vérifier l\'accès Lecteur du service account dans GA4 Admin.');
  } else {
    console.log('✅ GA4 OK\n');
    console.log('── SESSIONS PAR CANAL (30j) ──');
    (channels.json.rows ?? []).forEach((r: any) =>
      console.log(`  ${r.dimensionValues[0].value.padEnd(20)} ${r.metricValues[0].value.padStart(5)} sessions | ${r.metricValues[1].value.padStart(4)} users`));

    const landing = await ga({
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'landingPage' }],
      metrics: [{ name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 15,
    });
    console.log('\n── TOP 15 PAGES D\'ENTRÉE (30j) ──');
    (landing.json.rows ?? []).forEach((r: any) =>
      console.log(`  ${r.metricValues[0].value.padStart(5)} | ${r.dimensionValues[0].value}`));
  }

  /* ── 3. Synthèse ───────────────────────────────────── */
  sec('3/3 — STATUT DES ACCÈS');
  console.log(`  GSC : ${site ? '✅ ' + site : '❌ pas d\'accès'}`);
  console.log(`  GA4 : ${channels.status === 200 ? '✅ propriété ' + GA4_PROPERTY : '❌ ' + channels.status}`);
  console.log('═'.repeat(64));
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
