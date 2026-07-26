import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data, error } = await sb.from('consultations')
    .select('id, email, name, amount, status, created_at, lang')
    .gte('created_at', since)
    .order('created_at', { ascending: false });
  if (error) { console.error(error); process.exit(1); }
  console.log(`\n${data?.length ?? 0} paiement(s) dans les 24h:\n`);
  data?.forEach(r => console.log(`  ${r.created_at.slice(0, 19)}  €${String(r.amount).padStart(5)}  ${(r.email ?? r.name ?? '?').padEnd(35)}  ${r.status}  lang=${r.lang ?? 'fr'}`));
}
main();
