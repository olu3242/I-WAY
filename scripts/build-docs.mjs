#!/usr/bin/env node
// Converts docs/PRD.md and docs/BRD.md to Word (.docx) in dist/. Requires pandoc (https://pandoc.org).
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
mkdirSync('dist', { recursive: true });
for (const [src, out] of [['docs/PRD.md', 'dist/I-way_PRD.docx'], ['docs/BRD.md', 'dist/I-way_BRD.docx']]) {
  execFileSync('pandoc', [src, '-o', out, '--toc', '--toc-depth=2'], { stdio: 'inherit' });
  console.log('wrote', out);
}
