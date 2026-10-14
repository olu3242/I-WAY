#!/usr/bin/env node
// Builds deployable static pages: site/src/pages/*.html + site/src/partials/*.html -> site/public/*.html
// Partials are included with <!--@include name--> (name = file in site/src/partials, without extension).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'site');
const pagesDir = join(root, 'src', 'pages');
const partialsDir = join(root, 'src', 'partials');
const outDir = join(root, 'public');

const partials = Object.fromEntries(
  readdirSync(partialsDir).filter(f => f.endsWith('.html')).map(f => [f.replace(/\.html$/, ''), readFileSync(join(partialsDir, f), 'utf8').trimEnd()])
);

let count = 0;
for (const file of readdirSync(pagesDir).filter(f => f.endsWith('.html'))) {
  let html = readFileSync(join(pagesDir, file), 'utf8');
  html = html.replace(/<!--@include ([\w-]+)-->/g, (_, name) => {
    if (!(name in partials)) throw new Error(`Unknown partial "${name}" in ${file}`);
    return partials[name];
  });
  writeFileSync(join(outDir, file), html);
  count++;
}
console.log(`Built ${count} pages -> site/public`);
