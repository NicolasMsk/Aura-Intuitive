/* ════════════════════════════════════════════════════
   Aura Intuitive — Customer dedup & cohort analysis
   Run: npx tsx scripts/db-customers.ts
   ════════════════════════════════════════════════════ */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

type Row = {
  id: number;
  email: string | null;
  customer_email: string | null;
  status: string | null;
  amount: number | null;
  service: string | null;
  created_at: string;
  submitted_at: string | null;
};

const norm = (e: string | null) => (e ?? '').trim().toLowerCase();
const fmtEur = (n: number) => `€${n.toFixed(2)}`;
const pct = (a: number, b: number) => (b === 0 ? '0%' : `${((a / b) * 100).toFixed(1)}%`);
const section = (t: string) => console.log('\n' + '═'.repeat(60) + '\n  ' + t + '\n' + '═'.repeat(60));

async function main() {
  const { data, error } = await supabase
    .from('consultations')
    .select('id, email, customer_email, status, amount, service, created_at, submitted_at')
    .order('created_at', { ascending: true });

  if (error) { console.error(error); process.exit(1); }
  const all = (data ?? []) as Row[];
  // Only count REAL consultations (form submitted) — exclude fraud/abandons
  const rows = all.filter(r => r.status === 'submitted' || r.status === 'answered');

  // Use email (from form) primarily, fall back to customer_email (from Stripe)
  const emails = rows.map(r => norm(r.email) || norm(r.customer_email)).filter(e => e.length > 0);
  const uniqueEmails = new Set(emails);

  section('VOLUME D\'EMAILS');
  console.log(`Consultations réelles (form rempli) : ${rows.length}`);
  console.log(`Emails non vides                    : ${emails.length}`);
  console.log(`Emails uniques (dédoublonnés)       : ${uniqueEmails.size}`);
  console.log(`Lignes sans email                   : ${rows.length - emails.length}`);

  // Repeat customers
  const byEmail = new Map<string, Row[]>();
  rows.forEach(r => {
    const e = norm(r.email) || norm(r.customer_email);
    if (!e) return;
    if (!byEmail.has(e)) byEmail.set(e, []);
    byEmail.get(e)!.push(r);
  });

  const oneTime = Array.from(byEmail.values()).filter(v => v.length === 1).length;
  const repeat = Array.from(byEmail.values()).filter(v => v.length >= 2).length;
  const big = Array.from(byEmail.values()).filter(v => v.length >= 3).length;

  section('FIDÉLITÉ');
  console.log(`Clients uniques        : ${byEmail.size}`);
  console.log(`Clients 1 seule conso  : ${oneTime} (${pct(oneTime, byEmail.size)})`);
  console.log(`Clients 2+ consos      : ${repeat} (${pct(repeat, byEmail.size)})  ← potentiel newsletter`);
  console.log(`Clients 3+ consos      : ${big} (${pct(big, byEmail.size)})  ← super-fans`);

  // Top customers by spend
  const topByRevenue = Array.from(byEmail.entries())
    .map(([e, rs]) => ({
      email: e,
      count: rs.length,
      revenue: rs.reduce((s, r) => s + (r.amount ?? 0), 0),
      first: rs[0].created_at.slice(0, 10),
      last: rs[rs.length - 1].created_at.slice(0, 10),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  section('TOP 10 CLIENTES PAR DÉPENSE');
  topByRevenue.forEach((c, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. ${c.email.padEnd(45)} ${String(c.count).padStart(2)} consos  ${fmtEur(c.revenue).padStart(8)}  (${c.first} → ${c.last})`);
  });

  // New customers per month (first time we see this email)
  const firstSeenByEmail = new Map<string, string>();
  rows.forEach(r => {
    const e = norm(r.email) || norm(r.customer_email);
    if (!e) return;
    if (!firstSeenByEmail.has(e)) firstSeenByEmail.set(e, r.created_at);
  });

  const newByMonth = new Map<string, number>();
  Array.from(firstSeenByEmail.values()).forEach(d => {
    const m = d.slice(0, 7);
    newByMonth.set(m, (newByMonth.get(m) ?? 0) + 1);
  });

  section('NOUVEAUX CLIENTS PAR MOIS (1ère consultation)');
  Array.from(newByMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([m, n]) => {
      const bar = '█'.repeat(n);
      console.log(`  ${m}  ${String(n).padStart(3)}  ${bar}`);
    });

  // Total consultations per month + returning customers per month
  section('ACQUISITION vs FIDÉLISATION PAR MOIS');
  console.log('  Mois       Total  Nouveaux  Récurrents');
  const seen = new Set<string>();
  const monthly: Record<string, { total: number; new_: number; returning: number }> = {};
  rows.forEach(r => {
    const e = norm(r.email) || norm(r.customer_email);
    if (!e) return;
    const m = r.created_at.slice(0, 7);
    if (!monthly[m]) monthly[m] = { total: 0, new_: 0, returning: 0 };
    monthly[m].total++;
    if (seen.has(e)) {
      monthly[m].returning++;
    } else {
      monthly[m].new_++;
      seen.add(e);
    }
  });
  Object.entries(monthly).sort(([a], [b]) => a.localeCompare(b)).forEach(([m, v]) => {
    console.log(`  ${m}    ${String(v.total).padStart(4)}    ${String(v.new_).padStart(4)}     ${String(v.returning).padStart(4)}`);
  });

  // Average customer lifetime value
  section('LTV (Lifetime Value)');
  const totalRevenue = rows.reduce((s, r) => s + (r.amount ?? 0), 0);
  const customers = byEmail.size;
  console.log(`Revenu total                 : ${fmtEur(totalRevenue)}`);
  console.log(`Clients uniques              : ${customers}`);
  console.log(`LTV moyenne par cliente      : ${fmtEur(totalRevenue / customers)}`);
  const repeatRevenue = Array.from(byEmail.values())
    .filter(v => v.length >= 2)
    .flatMap(v => v.slice(1))
    .reduce((s, r) => s + (r.amount ?? 0), 0);
  console.log(`Revenu des consos récurrentes : ${fmtEur(repeatRevenue)} (${pct(repeatRevenue, totalRevenue)} du total)`);

  console.log('\n' + '═'.repeat(60));
}

main().catch(err => { console.error(err); process.exit(1); });
