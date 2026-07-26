/* ════════════════════════════════════════════════════
   Aura Intuitive — DB Analytics (read-only)
   Run: npx tsx scripts/db-analytics.ts
   ════════════════════════════════════════════════════ */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_KEY!;
if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

type Row = {
  id: number;
  stripe_session_id: string;
  service: string | null;
  amount: number | null;
  status: string | null;
  customer_email: string | null;
  name: string | null;
  email: string | null;
  birthdate: string | null;
  person_concerned: string | null;
  message: string | null;
  response: string | null;
  submitted_at: string | null;
  answered_at: string | null;
  created_at: string;
  lang?: string | null;
  email_status?: string | null;
  resend_email_id?: string | null;
};

const fmtEur = (n: number) => `€${n.toFixed(2)}`;
const pct = (a: number, b: number) => (b === 0 ? '0%' : `${((a / b) * 100).toFixed(1)}%`);

function section(title: string) {
  console.log('\n' + '═'.repeat(60));
  console.log('  ' + title);
  console.log('═'.repeat(60));
}

async function main() {
  const { data, error } = await supabase
    .from('consultations')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Query error:', error);
    process.exit(1);
  }

  const allRows = (data ?? []) as Row[];
  // Filtre : seulement les consultations réellement complétées (formulaire rempli).
  // Exclut toutes les transactions status='paid' jamais soumises (card testing / abandons).
  const rows = allRows.filter(r => r.status === 'submitted' || r.status === 'answered');
  const excludedFraud = allRows.filter(r => r.status === 'paid');

  section('VUE D\'ENSEMBLE (consultations réelles uniquement)');
  console.log(`Consultations réelles  : ${rows.length}`);
  console.log(`Exclues (paid jamais soumis, fraude/abandon) : ${excludedFraud.length}`);
  console.log(`Première consultation  : ${rows[0]?.created_at ?? 'N/A'}`);
  console.log(`Dernière consultation  : ${rows[rows.length - 1]?.created_at ?? 'N/A'}`);

  // Status breakdown (only real consultations)
  const byStatus = rows.reduce<Record<string, number>>((acc, r) => {
    const s = r.status ?? 'unknown';
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});
  section('STATUS');
  Object.entries(byStatus).forEach(([s, n]) => console.log(`  ${s.padEnd(15)} ${n}`));
  const submitted = rows.length;
  const answered = byStatus.answered ?? 0;
  console.log(`\nTaux de réponse : ${pct(answered, submitted)}`);

  // Revenue (only real consultations)
  const totalRevenue = rows.reduce((s, r) => s + (r.amount ?? 0), 0);
  section('REVENUS');
  console.log(`Revenu cumulé : ${fmtEur(totalRevenue)}`);
  if (rows.length) {
    console.log(`Panier moyen  : ${fmtEur(totalRevenue / rows.length)}`);
  }

  // By service
  section('PAR SERVICE');
  const byService = rows.reduce<Record<string, { count: number; revenue: number }>>((acc, r) => {
    const s = r.service ?? 'unknown';
    if (!acc[s]) acc[s] = { count: 0, revenue: 0 };
    acc[s].count++;
    acc[s].revenue += r.amount ?? 0;
    return acc;
  }, {});
  Object.entries(byService).forEach(([s, v]) =>
    console.log(`  ${s.padEnd(28)} ${String(v.count).padStart(4)}  ${fmtEur(v.revenue)}`),
  );

  // By language
  section('FR vs EN');
  const byLang = rows.reduce<Record<string, number>>((acc, r) => {
    const l = r.lang ?? 'fr';
    acc[l] = (acc[l] ?? 0) + 1;
    return acc;
  }, {});
  Object.entries(byLang).forEach(([l, n]) =>
    console.log(`  ${l.toUpperCase().padEnd(8)} ${n} (${pct(n, rows.length)})`),
  );

  // Monthly evolution
  section('ÉVOLUTION MENSUELLE');
  const byMonth = rows.reduce<Record<string, { count: number; revenue: number }>>((acc, r) => {
    const m = r.created_at.slice(0, 7); // YYYY-MM
    if (!acc[m]) acc[m] = { count: 0, revenue: 0 };
    acc[m].count++;
    acc[m].revenue += r.amount ?? 0;
    return acc;
  }, {});
  Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([m, v]) =>
      console.log(`  ${m}  ${String(v.count).padStart(3)} consultations  ${fmtEur(v.revenue)}`),
    );

  // Response delay
  section('DÉLAI DE RÉPONSE');
  const answeredWithDelay = rows.filter(r => r.status === 'answered' && r.submitted_at && r.answered_at);
  if (answeredWithDelay.length) {
    const delays = answeredWithDelay.map(r => {
      const t1 = new Date(r.submitted_at!).getTime();
      const t2 = new Date(r.answered_at!).getTime();
      return (t2 - t1) / (1000 * 60 * 60); // hours
    });
    delays.sort((a, b) => a - b);
    const avg = delays.reduce((s, d) => s + d, 0) / delays.length;
    const median = delays[Math.floor(delays.length / 2)];
    console.log(`  Délai moyen   : ${avg.toFixed(1)}h`);
    console.log(`  Délai médian  : ${median.toFixed(1)}h`);
    console.log(`  Délai max     : ${delays[delays.length - 1].toFixed(1)}h`);
    console.log(`  Délai min     : ${delays[0].toFixed(1)}h`);
    console.log(`  N             : ${answeredWithDelay.length}`);
  } else {
    console.log('  Aucune consultation répondue avec timestamps complets.');
  }

  // Email delivery
  section('DÉLIVRABILITÉ EMAILS');
  const byEmailStatus = rows.reduce<Record<string, number>>((acc, r) => {
    const s = r.email_status ?? '(no tracking)';
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});
  Object.entries(byEmailStatus).forEach(([s, n]) => console.log(`  ${s.padEnd(20)} ${n}`));

  // Day-of-week heatmap
  section('JOUR DE LA SEMAINE');
  const days = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
  const byDOW = Array(7).fill(0);
  rows.forEach(r => byDOW[new Date(r.created_at).getDay()]++);
  byDOW.forEach((n, i) => {
    const bar = '█'.repeat(n);
    console.log(`  ${days[i]} ${String(n).padStart(3)} ${bar}`);
  });

  // Hour heatmap
  section('HEURE (UTC, ajoute +2h pour Paris en été)');
  const byHour = Array(24).fill(0);
  rows.forEach(r => byHour[new Date(r.created_at).getUTCHours()]++);
  byHour.forEach((n, h) => {
    if (n > 0) console.log(`  ${String(h).padStart(2, '0')}h  ${String(n).padStart(3)} ${'█'.repeat(n)}`);
  });

  // Alertes
  section('ALERTES');
  const now = Date.now();
  const pendingResponse = rows.filter(r =>
    r.status === 'submitted' &&
    r.submitted_at &&
    (now - new Date(r.submitted_at).getTime()) > 24 * 3600 * 1000,
  );
  if (pendingResponse.length) {
    console.log(`\n⚠️  ${pendingResponse.length} consultation(s) attendant une réponse depuis >24h:`);
    pendingResponse.forEach(r =>
      console.log(`    • ${r.submitted_at}  ${r.name}  ${r.email}  (${r.lang ?? 'fr'})`),
    );
  } else {
    console.log('\n✅ Aucune consultation en attente de réponse depuis >24h.');
  }

  console.log('\n' + '═'.repeat(60));
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
