#!/usr/bin/env node
// IP-disclosure gate for the PUBLIC site. Fails (exit 1) if site/public contains internal-only terms.
// Extend docs/IP_DISCLOSURE_REVIEW.md and the list below together. This is a safety net, not a substitute for human review.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'site', 'public');
const banned = [
  'ai-native','ai native','agent','orchestrat','prompt','llm','algorithm','machine learning','model weights',
  'schema','database','mongodb','postgres','sql server','tenant','rbac','row-level','audit log','microservice','architecture',
  'roadmap','coming soon feature','go-to-market','market entry','competitor','profit margin','gross margin','management fee','escrow','settlement engine',
  'platform admin','fleet management agreement','dispatch eligib','business rule','api key','secret','internal only','confidential',
  'claude','anthropic','figma'
];
const exts = new Set(['.html', '.css', '.js', '.json', '.svg', '.txt', '.xml']);
const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : exts.has(extname(p)) && files.push(p); } })(root);

let hits = 0;
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const low = line.toLowerCase();
    for (const term of banned) {
      if (low.includes(term)) {
        // allow the config comment that tells developers never to put secrets here
        if (f.endsWith('config.js') && term === 'secret') continue;
        console.error(`${f.replace(root, 'site/public')}:${i + 1}  "${term}"  ->  ${line.trim().slice(0, 110)}`);
        hits++;
      }
    }
  });
}
if (hits) { console.error(`\nIP scan FAILED: ${hits} hit(s).`); process.exit(1); }
console.log(`IP scan passed (${files.length} public files, ${banned.length} terms).`);
