#!/usr/bin/env node
// Renders docs/architecture/*.mmd to SVG with Mermaid CLI (downloads a headless browser on first run).
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
const dir = 'docs/architecture';
for (const f of readdirSync(dir).filter(f => f.endsWith('.mmd'))) {
  execFileSync('npx', ['-y', '@mermaid-js/mermaid-cli', '-i', `${dir}/${f}`, '-o', `${dir}/${f.replace('.mmd', '.svg')}`], { stdio: 'inherit' });
}
