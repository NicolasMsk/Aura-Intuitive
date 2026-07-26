/* GSC URL Inspection — real Google indexation status per URL
   Run: npx tsx scripts/gsc-inspect.ts
*/
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SA = JSON.parse(readFileSync(path.join(__dirname, '..', 'credentials', 'service_account.json'), 'utf8'));
const SITE = 'https://www.auraintuitive.fr/';
const b64url = (s: Buffer | string) => Buffer.from(s).toString('base64url');

const URLS = [
  'https://www.auraintuitive.fr/',
  'https://www.auraintuitive.fr/blog',
  'https://www.auraintuitive.fr/blog/mon-ex-va-t-il-revenir-voyance',
  'https://www.auraintuitive.fr/blog/voyance-1-euro-serieuse',
  'https://www.auraintuitive.fr/blog/consultation-voyance-pas-chere',
  'https://www.auraintuitive.fr/blog/voyance-amoureuse-comprendre-sentiments',
  'https://www.auraintuitive.fr/blog/voyance-argent-finances',
  'https://www.auraintuitive.fr/blog/voyance-gratuite-vs-payante-difference',
  'https://www.auraintuitive.fr/blog/mon-ex-a-refait-sa-vie-voyance',
  'https://www.auraintuitive.fr/blog/heures-miroirs-guide-complet',
  'https://www.auraintuitive.fr/blog/heure-miroir-11h11-signification',
  'https://www.auraintuitive.fr/en/',
  'https://www.auraintuitive.fr/en/blog/mirror-hour-11-11-meaning',
  'https://www.auraintuitive.fr/en/blog/will-my-ex-come-back-psychic',
];

async function token() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: SA.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const s = createSign('RSA-SHA256'); s.update(`${header}.${claims}`);
  const jwt = `${header}.${claims}.${s.sign(SA.private_key, 'base64url')}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  });
  return ((await res.json()) as any).access_token;
}

async function main() {
  const t = await token();
  console.log('URL Inspection — verdict Google par page\n');
  for (const url of URLS) {
    const res = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inspectionUrl: url, siteUrl: SITE }),
    });
    const j = await res.json() as any;
    if (res.status !== 200) {
      console.log(`❓ ${url}\n   API ${res.status}: ${j?.error?.message}\n`);
      continue;
    }
    const r = j.inspectionResult?.indexStatusResult ?? {};
    const short = url.replace('https://www.auraintuitive.fr', '') || '/';
    const indexed = r.coverageState ?? '?';
    const canonicalGoogle = r.googleCanonical ?? '—';
    const canonicalUser = r.userCanonical ?? '—';
    const lastCrawl = r.lastCrawlTime ? r.lastCrawlTime.slice(0, 10) : 'jamais';
    const verdict = r.verdict ?? '?';
    const icon = verdict === 'PASS' ? '✅' : verdict === 'NEUTRAL' ? '🟡' : '🔴';
    console.log(`${icon} ${short}`);
    console.log(`   État: ${indexed} | Dernier crawl: ${lastCrawl}`);
    if (canonicalGoogle !== canonicalUser && canonicalGoogle !== '—') {
      console.log(`   ⚠️ Canonical Google: ${canonicalGoogle} ≠ déclaré: ${canonicalUser}`);
    }
    console.log('');
    await new Promise(r => setTimeout(r, 400)); // rate-limit friendly
  }
}
main().catch(e => { console.error(e); process.exit(1); });
