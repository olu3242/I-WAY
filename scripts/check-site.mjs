#!/usr/bin/env node
// Static checks for site/public: broken internal links/anchors, missing alt text, missing form labels, lang attr, duplicate ids.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'site', 'public');
const pages = readdirSync(root).filter(f => f.endsWith('.html'));
const ids = {};
const html = {};
for (const p of pages) { html[p] = readFileSync(join(root, p), 'utf8'); ids[p] = new Set([...html[p].matchAll(/\sid="([^"]+)"/g)].map(m => m[1])); }
let errors = 0;
const fail = (p, msg) => { console.error(`${p}: ${msg}`); errors++; };

for (const p of pages) {
  const h = html[p];
  if (!/<html[^>]*\slang="/.test(h)) fail(p, 'missing <html lang>');
  if (!/<title>[^<]+<\/title>/.test(h)) fail(p, 'missing <title>');
  if ((h.match(/<h1[\s>]/g) || []).length !== 1) fail(p, 'page must have exactly one <h1>');
  const idList = [...h.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  idList.filter((x, i) => idList.indexOf(x) !== i && !x.startsWith('i-')).forEach(x => fail(p, `duplicate id "${x}"`));
  for (const m of h.matchAll(/<img\b[^>]*>/g)) if (!/\salt=/.test(m[0])) fail(p, `img without alt: ${m[0].slice(0, 60)}`);
  for (const m of h.matchAll(/<(input|select|textarea)\b[^>]*\sid="([^"]+)"/g)) if (!new RegExp(`for="${m[2]}"`).test(h)) fail(p, `form control #${m[2]} has no <label for>`);
  for (const m of h.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|tel:|#?$)/.test(href)) continue;
    const [file, frag] = href.split('#');
    const target = file || p;
    if (file && !existsSync(join(root, file))) fail(p, `broken link ${href}`);
    else if (frag && !(ids[target] && ids[target].has(frag))) fail(p, `missing anchor ${href}`);
    if (href === '#') fail(p, 'dead "#" link');
  }
  for (const m of h.matchAll(/(?:src|href)="(assets\/[^"]+|favicon\.svg)"/g)) if (!existsSync(join(root, m[1]))) fail(p, `missing asset ${m[1]}`);
  for (const m of h.matchAll(/<use href="#([^"]+)"/g)) if (!html[p].includes(`id="${m[1]}"`)) fail(p, `missing icon symbol #${m[1]}`);
}
if (errors) { console.error(`\nSite check FAILED: ${errors} issue(s).`); process.exit(1); }
console.log(`Site check passed (${pages.length} pages).`);
