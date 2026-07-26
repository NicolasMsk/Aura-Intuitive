/* ════════════════════════════════════════════════════
   Aura Intuitive — Technical SEO crawl audit (live prod)
   Run: npx tsx scripts/tech-audit.ts
   Checks: statuses, canonicals, hreflang reciprocity,
   titles, robots meta, internal 404s, redirect hops.
   ════════════════════════════════════════════════════ */

const BASE = 'https://www.auraintuitive.fr';
const UA = 'AuraAudit/1.0 (technical SEO self-audit)';

type PageInfo = {
  url: string;
  status: number;
  canonical?: string;
  hreflang: Record<string, string>;
  robotsMeta?: string;
  title?: string;
  titleLen?: number;
  ogUrl?: string;
  internalLinks: string[];
  redirectedTo?: string;
};

const issues: { sev: 'CRITIQUE' | 'MAJEUR' | 'MINEUR'; msg: string }[] = [];
const add = (sev: 'CRITIQUE' | 'MAJEUR' | 'MINEUR', msg: string) => issues.push({ sev, msg });

async function fetchPage(url: string): Promise<PageInfo> {
  const info: PageInfo = { url, status: 0, hreflang: {}, internalLinks: [] };
  try {
    const res = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': UA } });
    info.status = res.status;
    if (res.status >= 300 && res.status < 400) {
      info.redirectedTo = res.headers.get('location') ?? undefined;
      return info;
    }
    if (res.status !== 200) return info;
    const html = await res.text();

    const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i);
    if (canonical) info.canonical = canonical[1];

    for (const m of html.matchAll(/<link\s+rel="alternate"\s+hreflang="([^"]+)"\s+href="([^"]+)"/gi)) {
      info.hreflang[m[1]] = m[2];
    }

    const robots = html.match(/<meta\s+name="robots"\s+content="([^"]+)"/i);
    if (robots) info.robotsMeta = robots[1];

    const title = html.match(/<title>([^<]*)<\/title>/i);
    if (title) { info.title = title[1]; info.titleLen = title[1].length; }

    const og = html.match(/<meta\s+property="og:url"\s+content="([^"]+)"/i);
    if (og) info.ogUrl = og[1];

    for (const m of html.matchAll(/href="(\/[^"#?]*)[#?]?[^"]*"/g)) {
      const path = m[1];
      if (path.startsWith('/images/') || path.includes('.css') || path.includes('.js') ||
          path.includes('.xml') || path.includes('.txt') || path.includes('.ico') ||
          path.includes('.png') || path.includes('.webmanifest') || path.includes('.avif') || path.includes('.jpg')) continue;
      info.internalLinks.push(path);
    }
    return info;
  } catch (e: any) {
    info.status = -1;
    add('CRITIQUE', `${url} — fetch error: ${e.message}`);
    return info;
  }
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }));
  return results;
}

async function main() {
  console.log('🕷  Récupération du sitemap live...');
  const smRes = await fetch(`${BASE}/sitemap.xml`, { headers: { 'User-Agent': UA } });
  const sm = await smRes.text();
  const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  console.log(`   ${urls.length} URLs dans le sitemap\n`);

  // .html leak in sitemap
  urls.filter(u => u.endsWith('.html')).forEach(u => add('MAJEUR', `Sitemap contient une URL .html : ${u}`));

  console.log('🕷  Crawl des pages (concurrence 6)...');
  const pages = await pool(urls, 6, fetchPage);

  const byUrl = new Map(pages.map(p => [p.url, p]));

  for (const p of pages) {
    // 1. status
    if (p.status !== 200) {
      add('CRITIQUE', `${p.url} — HTTP ${p.status}${p.redirectedTo ? ' → ' + p.redirectedTo : ''} (URL du sitemap doit être 200 direct)`);
      continue;
    }
    // 2. canonical
    if (!p.canonical) add('MAJEUR', `${p.url} — pas de canonical`);
    else if (p.canonical !== p.url) add('CRITIQUE', `${p.url} — canonical ≠ URL sitemap : ${p.canonical}`);
    if (p.canonical?.endsWith('.html')) add('CRITIQUE', `${p.url} — canonical en .html`);
    // 3. hreflang self
    const isEN = p.url.includes('/en');
    const selfLang = isEN ? 'en' : 'fr';
    if (Object.keys(p.hreflang).length > 0) {
      const self = p.hreflang[selfLang];
      if (!self) add('MAJEUR', `${p.url} — hreflang ${selfLang} (self) absent`);
      else if (self !== p.url) add('MAJEUR', `${p.url} — hreflang self ≠ URL : ${self}`);
      Object.values(p.hreflang).forEach(h => { if (h.endsWith('.html')) add('CRITIQUE', `${p.url} — hreflang en .html : ${h}`); });
    }
    // 4. robots
    if (p.robotsMeta?.includes('noindex')) add('MAJEUR', `${p.url} — noindex alors qu'elle est dans le sitemap`);
    // 5. title
    if (p.titleLen && p.titleLen > 65) add('MINEUR', `${p.url} — title ${p.titleLen}c : "${p.title}"`);
    if (!p.title) add('MAJEUR', `${p.url} — pas de <title>`);
    // 6. og:url mismatch
    if (p.ogUrl && p.ogUrl !== p.url && p.ogUrl !== p.url + '/' && p.ogUrl + '/' !== p.url) {
      add('MINEUR', `${p.url} — og:url ≠ canonical : ${p.ogUrl}`);
    }
  }

  // 7. hreflang reciprocity
  console.log('🔁 Vérification réciprocité hreflang...');
  for (const p of pages) {
    if (p.status !== 200) continue;
    const isEN = p.url.includes('/en');
    const otherLang = isEN ? 'fr' : 'en';
    const target = p.hreflang[otherLang];
    if (!target) continue;
    const targetPage = byUrl.get(target);
    if (!targetPage) {
      // target not in sitemap — check reachability + its hreflang back
      const tp = await fetchPage(target);
      if (tp.status !== 200) add('CRITIQUE', `${p.url} — hreflang ${otherLang} pointe vers ${target} qui répond ${tp.status}`);
      else if (tp.hreflang[isEN ? 'en' : 'fr'] !== p.url) add('MAJEUR', `${p.url} ↔ ${target} — hreflang non réciproque (retour: ${tp.hreflang[isEN ? 'en' : 'fr'] ?? 'absent'})`);
      if (tp.status === 200 && !urls.includes(target)) add('MAJEUR', `${target} — cible hreflang absente du sitemap`);
    } else {
      const back = targetPage.hreflang[isEN ? 'en' : 'fr'];
      if (back !== p.url) add('MAJEUR', `${p.url} ↔ ${target} — hreflang non réciproque (retour: ${back ?? 'absent'})`);
    }
  }

  // 8. internal links 404 check
  console.log('🔗 Vérification des liens internes (dédupliqués)...');
  const allLinks = new Set<string>();
  pages.forEach(p => p.internalLinks.forEach(l => allLinks.add(l)));
  const linkList = [...allLinks];
  console.log(`   ${linkList.length} liens internes uniques à tester`);
  const linkResults = await pool(linkList, 6, async (path) => {
    try {
      const res = await fetch(BASE + path, { redirect: 'manual', headers: { 'User-Agent': UA } });
      return { path, status: res.status, loc: res.headers.get('location') };
    } catch { return { path, status: -1, loc: null }; }
  });
  for (const r of linkResults) {
    if (r.status === 404 || r.status === -1) add('CRITIQUE', `Lien interne cassé : ${r.path} → ${r.status}`);
    else if (r.status >= 300 && r.status < 400 && r.path !== '/form' && r.path !== '/en/form' && r.path !== '/en' && r.path !== '/en/blog') {
      add('MINEUR', `Lien interne redirigé (perte de jus) : ${r.path} → ${r.status} ${r.loc}`);
    }
  }

  // 9. redirect hygiene: single hop, http→https, non-www
  console.log('↪️  Vérification des redirections (hops)...');
  const redirectTests = [
    `${BASE}/blog/voyance-1-euro-serieuse.html`,
    `${BASE}/en/about.html`,
    'http://www.auraintuitive.fr/',
    'https://auraintuitive.fr/',
  ];
  for (const t of redirectTests) {
    let cur = t, hops = 0;
    try {
      while (hops < 5) {
        const res = await fetch(cur, { redirect: 'manual', headers: { 'User-Agent': UA } });
        if (res.status >= 300 && res.status < 400) {
          const loc = res.headers.get('location')!;
          cur = loc.startsWith('http') ? loc : BASE + loc;
          hops++;
        } else {
          if (hops > 1) add('MINEUR', `${t} — chaîne de ${hops} redirections avant 200 (idéal: 1)`);
          if (res.status !== 200) add('MAJEUR', `${t} — fin de chaîne en ${res.status}`);
          break;
        }
      }
      if (hops >= 5) add('CRITIQUE', `${t} — boucle/chaîne de redirections > 5`);
    } catch (e: any) {
      const cause = e?.cause?.code ?? e?.code ?? e.message;
      if (String(cause).includes('CERT') || String(cause).includes('TLS')) {
        add('CRITIQUE', `${t} — certificat TLS invalide (${e?.cause?.reason ?? cause}) : la variante de domaine est inaccessible en HTTPS`);
      } else {
        add('CRITIQUE', `${t} — erreur réseau : ${cause}`);
      }
    }
  }

  // Report
  console.log('\n' + '═'.repeat(66));
  console.log('  RÉSULTAT AUDIT TECHNIQUE');
  console.log('═'.repeat(66));
  const bySeV = { CRITIQUE: issues.filter(i => i.sev === 'CRITIQUE'), MAJEUR: issues.filter(i => i.sev === 'MAJEUR'), MINEUR: issues.filter(i => i.sev === 'MINEUR') };
  console.log(`Pages crawlées: ${pages.length} | 🔴 ${bySeV.CRITIQUE.length} critiques | 🟠 ${bySeV.MAJEUR.length} majeurs | 🟡 ${bySeV.MINEUR.length} mineurs\n`);
  for (const sev of ['CRITIQUE', 'MAJEUR', 'MINEUR'] as const) {
    if (bySeV[sev].length) {
      console.log(`── ${sev === 'CRITIQUE' ? '🔴' : sev === 'MAJEUR' ? '🟠' : '🟡'} ${sev} (${bySeV[sev].length}) ──`);
      bySeV[sev].forEach(i => console.log('  • ' + i.msg));
      console.log('');
    }
  }
  if (!issues.length) console.log('✅ Aucun problème détecté sur les 9 familles de checks.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
