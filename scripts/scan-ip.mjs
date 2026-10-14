import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
const root = 'site/public';
const forbidden = [/\b(?:internal|confidential)\s*[-:]\s*(?:prd|brd|architecture)\b/i,/\b(?:service_role|SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL|PRIVATE_KEY)\b/,/\b(?:settlement formula|proprietary algorithm|agent prompt)\b/i];
let errors = [];
async function scan(dir) {
  for (const e of await readdir(dir,{withFileTypes:true})) {
    const p=join(dir,e.name);
    if(e.isDirectory()) await scan(p);
    else if(/\.(?:html|css|js|json|txt|svg)$/i.test(e.name)) {
      const s=await readFile(p,'utf8');
      if(forbidden.some(re=>re.test(s))) errors.push(relative(root,p));
    }
  }
}
try { await scan(root); } catch(e) { console.error('NO-GO: public build missing:',e.message); process.exit(1); }
if(errors.length){console.error('NO-GO: IP scan findings:',errors.join(', '));process.exit(1);}
console.log('Automated IP scan PASS (human review still required)');
