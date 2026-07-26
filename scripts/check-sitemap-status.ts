import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SA = JSON.parse(readFileSync(path.join(__dirname, '..', 'credentials', 'service_account.json'), 'utf8'));
const b64url = (s: Buffer | string) => Buffer.from(s).toString('base64url');

async function token(scopes: string[]) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: SA.client_email, scope: scopes.join(' '), aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const jwt = `${header}.${claims}.${signer.sign(SA.private_key, 'base64url')}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  });
  return ((await res.json()) as any).access_token;
}

async function main() {
  const t = await token(['https://www.googleapis.com/auth/webmasters.readonly']);
  const site = encodeURIComponent('https://www.auraintuitive.fr/');
  const res = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${site}/sitemaps`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  const json = await res.json() as any;
  console.log(JSON.stringify(json, null, 2));
}
main();
