import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['scripts/check-merge-conflicts.mjs'],{stdio:'inherit'});
const paths=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0');
for(const path of [...new Set(paths)].filter(p=>/\.(mjs|cjs|js)$/.test(p)&&!p.startsWith('reference/')&&!p.startsWith('.worktrees/')))execFileSync(process.execPath,['--check',path],{stdio:'pipe'});
console.log('JavaScript syntax PASS');
