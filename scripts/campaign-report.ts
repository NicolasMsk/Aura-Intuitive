/* Campaign report — focused on the -50% Ressenti campaign
   Run: npx tsx scripts/campaign-report.ts
*/
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const RESEND_KEY = process.env.RESEND_API_KEY!;

// Campaign was sent 2026-06-25 07:28:33 UTC
const CAMPAIGN_START = new Date('2026-06-25T07:28:00Z');
const CAMPAIGN_SUBJECT_PATTERN = 'attention pour toi';

const sec = (t: string) => console.log('\n' + '═'.repeat(64) + '\n  ' + t + '\n' + '═'.repeat(64));
const pct = (a: number, b: number) => b === 0 ? '0%' : `${((a / b) * 100).toFixed(1)}%`;

async function main() {
  // 1. Fetch all Resend emails matching campaign
  const res = await fetch('https://api.resend.com/emails?limit=100', {
    headers: { Authorization: `Bearer ${RESEND_KEY}` },
  });
  const json = await res.json() as { data?: any[] };
  const allEmails = json.data ?? [];

  const campaignEmails = allEmails.filter(e =>
    new Date(e.created_at).getTime() >= CAMPAIGN_START.getTime() &&
    (e.subject ?? '').toLowerCase().includes(CAMPAIGN_SUBJECT_PATTERN)
  );

  sec(`📨 CAMPAGNE "${CAMPAIGN_SUBJECT_PATTERN}" — ÉTAT À J+2`);
  console.log(`Envoyée le         : ${CAMPAIGN_START.toISOString().slice(0, 19)}Z`);
  console.log(`Emails campagne     : ${campaignEmails.length}`);

  const byStatus: Record<string, number> = {};
  campaignEmails.forEach(e => {
    const s = e.last_event ?? 'sent';
    byStatus[s] = (byStatus[s] ?? 0) + 1;
  });

  sec('STATUT DES EMAILS');
  console.log(`  ✉  Délivrés     : ${(byStatus['delivered'] ?? 0)}  (${pct(byStatus['delivered'] ?? 0, campaignEmails.length)})`);
  console.log(`  👁  Ouverts      : ${(byStatus['opened'] ?? 0)}  (${pct(byStatus['opened'] ?? 0, campaignEmails.length)})`);
  console.log(`  🖱  Cliqués      : ${(byStatus['clicked'] ?? 0)}  (${pct(byStatus['clicked'] ?? 0, campaignEmails.length)})`);
  console.log(`  ❌ Suppressed   : ${(byStatus['suppressed'] ?? 0)}  (typos / bounces)`);
  console.log(`  📧 Sent (no open): ${(byStatus['sent'] ?? 0)}`);

  const totalEngaged = (byStatus['opened'] ?? 0) + (byStatus['clicked'] ?? 0);
  console.log(`\n  🎯 Taux d'engagement (ouvert + cliqué) : ${totalEngaged} / ${campaignEmails.length} = ${pct(totalEngaged, campaignEmails.length)}`);

  // 2. Who clicked?
  const clickedEmails = campaignEmails.filter(e => e.last_event === 'clicked');
  if (clickedEmails.length) {
    sec('🖱 ONT CLIQUÉ SUR LE BOUTON');
    clickedEmails.forEach(e => {
      console.log(`  ${(e.to?.[0] ?? '?').padEnd(40)}  ${e.created_at.slice(0, 19)}`);
    });
  }

  // 3. Who bounced (suppressed)?
  const suppressed = campaignEmails.filter(e => e.last_event === 'suppressed');
  if (suppressed.length) {
    sec('❌ EMAILS BOUNCÉS / INVALIDES');
    suppressed.forEach(e => {
      console.log(`  ${(e.to?.[0] ?? '?').padEnd(40)}  ${e.created_at.slice(0, 19)}`);
    });
  }

  // 4. Conversions DB — €5 paid since campaign start
  const { data: paid } = await sb
    .from('consultations')
    .select('id, email, name, amount, status, created_at, submitted_at, answered_at')
    .eq('amount', 5)
    .gte('created_at', CAMPAIGN_START.toISOString())
    .order('created_at', { ascending: true });

  sec('💰 CONVERSIONS €5 DEPUIS LA CAMPAGNE');
  if (!paid?.length) {
    console.log('Aucune conversion €5 enregistrée encore.');
  } else {
    console.log(`${paid.length} paiement(s) €5 :`);
    paid.forEach(r => {
      console.log(`\n  📌 ${r.created_at.slice(0, 19)}  €${r.amount}`);
      console.log(`     Email     : ${r.email ?? '(non rempli)'}`);
      console.log(`     Nom       : ${r.name ?? '(non rempli)'}`);
      console.log(`     Status    : ${r.status}`);
      if (r.submitted_at) console.log(`     Soumis    : ${r.submitted_at.slice(0, 19)}`);
      if (r.answered_at) console.log(`     Répondu   : ${r.answered_at.slice(0, 19)}`);
    });

    const revenue = paid.length * 5;
    sec('💸 REVENU DE LA CAMPAGNE');
    console.log(`  Conversions       : ${paid.length}`);
    console.log(`  Revenu brut       : €${revenue}`);
    console.log(`  Taux de conversion: ${pct(paid.length, campaignEmails.length)}`);
  }

  // 5. Comparaison ouvert mais pas converti = qui relancer
  sec('🎯 PROSPECTS À RELANCER (ouverts mais pas convertis)');
  const opened = campaignEmails.filter(e => ['opened', 'clicked'].includes(e.last_event));
  const paidEmails = new Set((paid ?? []).map(p => (p.email ?? '').toLowerCase()));
  const openedNotConverted = opened.filter(e =>
    !paidEmails.has((e.to?.[0] ?? '').toLowerCase())
  );
  console.log(`${openedNotConverted.length} personnes ont ouvert mais n'ont pas (encore) acheté :\n`);
  openedNotConverted.forEach(e => {
    console.log(`  ${(e.to?.[0] ?? '?').padEnd(45)}  status: ${e.last_event}`);
  });

  // 6. Not opened — peut-être relance avec autre objet
  sec('📭 N\'ONT PAS OUVERT (peut tenter une relance avec autre objet)');
  const notOpened = campaignEmails.filter(e => !['opened', 'clicked'].includes(e.last_event));
  console.log(`${notOpened.length} destinataires :\n`);
  notOpened.forEach(e => {
    console.log(`  ${(e.to?.[0] ?? '?').padEnd(45)}  status: ${e.last_event}`);
  });

  console.log('\n' + '═'.repeat(64));
}

main().catch(e => { console.error(e); process.exit(1); });
