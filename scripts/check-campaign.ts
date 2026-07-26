/* Check campaign send status via Resend API + DB
   Run: npx tsx scripts/check-campaign.ts
*/
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const RESEND_KEY = process.env.RESEND_API_KEY!;

const section = (t: string) => console.log('\n' + '═'.repeat(60) + '\n  ' + t + '\n' + '═'.repeat(60));

async function listRecentResendEmails() {
  // Resend "list emails" — returns up to 100 most recent
  const res = await fetch('https://api.resend.com/emails?limit=100', {
    headers: { Authorization: `Bearer ${RESEND_KEY}` },
  });
  if (!res.ok) {
    console.error('Resend API error:', res.status, await res.text());
    return [];
  }
  const json = await res.json() as { data?: Array<any> };
  return json.data ?? [];
}

async function main() {
  section('RESEND — 100 DERNIERS EMAILS ENVOYÉS');
  const emails = await listRecentResendEmails();
  if (!emails.length) {
    console.log('Aucun email récent récupéré depuis Resend.');
    return;
  }

  // Sort by created_at desc
  emails.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Last hour
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const recent = emails.filter(e => new Date(e.created_at).getTime() > oneHourAgo);

  console.log(`Total récupérés      : ${emails.length}`);
  console.log(`Dernière heure       : ${recent.length}`);
  console.log(`Plus récent          : ${emails[0]?.created_at ?? 'N/A'}  → ${emails[0]?.to?.[0] ?? '?'}`);

  // Show last 50 with status
  section('DÉTAIL DES 50 DERNIERS ENVOIS');
  console.log('Date                 To                                       Subject (40 chars)              Status');
  console.log('-'.repeat(120));
  emails.slice(0, 50).forEach(e => {
    const date = e.created_at.slice(0, 19).replace('T', ' ');
    const to = (e.to?.[0] ?? '?').padEnd(40);
    const subj = (e.subject ?? '').slice(0, 38).padEnd(38);
    const status = (e.last_event ?? 'sent').padEnd(10);
    console.log(`${date}  ${to}  ${subj}  ${status}`);
  });

  // Group by status
  section('RÉSUMÉ PAR STATUT (100 derniers)');
  const byStatus: Record<string, number> = {};
  emails.forEach(e => {
    const s = e.last_event ?? 'sent';
    byStatus[s] = (byStatus[s] ?? 0) + 1;
  });
  Object.entries(byStatus).forEach(([s, n]) => console.log(`  ${s.padEnd(20)} ${n}`));

  // Group recent (last hour) by status
  if (recent.length) {
    section(`RÉSUMÉ DERNIÈRE HEURE (${recent.length} emails)`);
    const recentByStatus: Record<string, number> = {};
    recent.forEach(e => {
      const s = e.last_event ?? 'sent';
      recentByStatus[s] = (recentByStatus[s] ?? 0) + 1;
    });
    Object.entries(recentByStatus).forEach(([s, n]) => console.log(`  ${s.padEnd(20)} ${n}`));
  }

  // Check DB for new €5 consultations since campaign (last 24h)
  section('DB — NOUVEAUX PAIEMENTS €5 DANS LES 24H');
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('consultations')
    .select('id, email, name, amount, status, created_at')
    .eq('amount', 5)
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return; }
  if (!data?.length) {
    console.log('Aucun paiement €5 enregistré dans les 24 dernières heures.');
  } else {
    console.log(`${data.length} paiement(s) €5 trouvé(s) :`);
    data.forEach(r => console.log(`  ${r.created_at.slice(0, 19)}  ${(r.email ?? r.name ?? '?').padEnd(35)}  ${r.status}`));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
