import 'dotenv/config';

async function main() {
  const res = await fetch('https://api.resend.com/emails?limit=100', {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY!}` },
  });
  const json = await res.json() as { data?: any[] };
  const emails = json.data ?? [];
  const now = Date.now();
  const recent = emails
    .filter(e => now - new Date(e.created_at).getTime() < 3 * 3600 * 1000)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  console.log(`\n${recent.length} email(s) dans les 3 dernières heures :\n`);
  recent.slice(0, 80).forEach(e => {
    const date = e.created_at.slice(0, 19);
    const to = (e.to?.[0] ?? '?').padEnd(38).slice(0, 38);
    const subj = (e.subject ?? '').padEnd(52).slice(0, 52);
    const status = (e.last_event ?? 'sent').padEnd(10);
    console.log(`  ${date}  ${to}  ${subj}  ${status}`);
  });

  // Group by subject
  const bySubject: Record<string, { total: number; opened: number; clicked: number; delivered: number; suppressed: number }> = {};
  recent.forEach(e => {
    const subj = e.subject ?? '(no subject)';
    if (!bySubject[subj]) bySubject[subj] = { total: 0, opened: 0, clicked: 0, delivered: 0, suppressed: 0 };
    bySubject[subj].total++;
    const s = e.last_event ?? 'sent';
    if (s === 'opened') bySubject[subj].opened++;
    else if (s === 'clicked') bySubject[subj].clicked++;
    else if (s === 'delivered') bySubject[subj].delivered++;
    else if (s === 'suppressed') bySubject[subj].suppressed++;
  });

  console.log('\n═══ RÉSUMÉ PAR SUJET ═══\n');
  Object.entries(bySubject).forEach(([subj, s]) => {
    console.log(`"${subj}"`);
    console.log(`  Total: ${s.total} | Delivered: ${s.delivered} | Opened: ${s.opened} | Clicked: ${s.clicked} | Suppressed: ${s.suppressed}\n`);
  });
}

main().catch(e => { console.error(e); process.exit(1); });
