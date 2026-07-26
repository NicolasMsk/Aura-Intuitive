import 'dotenv/config';

async function main() {
  const key = process.env.RESEND_API_KEY!;
  // Find nicolas.musicki@gmail.com in recent emails
  const list = await fetch('https://api.resend.com/emails?limit=100', {
    headers: { Authorization: `Bearer ${key}` },
  });
  const listJson = await list.json() as { data?: any[] };
  const targetEmails = (listJson.data ?? []).filter(e =>
    (e.to?.[0] ?? '').toLowerCase() === 'nicolas.musicki@gmail.com'
  );

  console.log(`\n${targetEmails.length} email(s) trouvé(s) pour nicolas.musicki@gmail.com\n`);
  targetEmails.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  for (const e of targetEmails.slice(0, 5)) {
    console.log(`\n═══ Email ${e.id} ═══`);
    console.log(`  Créé      : ${e.created_at}`);
    console.log(`  Objet     : ${e.subject}`);
    console.log(`  Last event: ${e.last_event}`);

    // Get detailed info
    const detail = await fetch(`https://api.resend.com/emails/${e.id}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const dj = await detail.json();
    console.log(`  Détails complets:`);
    console.log(JSON.stringify(dj, null, 2));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
