// Read-only CLI plan only. There is intentionally no live-push execution branch.
import {spawnSync} from 'node:child_process';
import {readFileSync,readdirSync,mkdirSync,writeFileSync,copyFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {uatProject,migrationNames,migrationManifest,cliVersion} from './lib/recovery-v2.mjs';
export function guardedDryRunPlan({linkedProject,files,manifest,approved}){
 if(linkedProject!==uatProject)throw Error('EXACT_UAT_LINK_REQUIRED');
 if(JSON.stringify([...files].sort())!==JSON.stringify([...migrationNames].sort()))throw Error('EXACT_EIGHT_MIGRATIONS_REQUIRED');
 if(manifest.length!==8||manifest.some((m,i)=>m.file!==approved[i]?.file||m.lfSha256!==approved[i]?.lfSha256))throw Error('REVIEWED_MIGRATION_HASH_REQUIRED');
 return ['db','push','--project-ref',uatProject,'--dry-run','--skip-vault'];
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  if(process.argv.length!==2||process.env.IWAY_UAT_DRY_RUN_OPT_IN!=='true')throw Error('EXPLICIT_READONLY_OPT_IN_REQUIRED');
  const manifest=migrationManifest('supabase/migrations'),approved=JSON.parse(readFileSync('docs/certification/b902-b1000/migration-manifest.json'));
  const args=guardedDryRunPlan({linkedProject:readFileSync('supabase/.temp/project-ref','utf8').trim(),files:readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')),manifest,approved});
  const cli=resolve(process.env.IWAY_RECOVERY_CLI??'dist/b902-b1000/tools/cli-2.122.0/supabase.exe');
  const v=spawnSync(cli,['--version'],{encoding:'utf8',timeout:30000});if(v.status||v.stdout.trim()!==cliVersion)throw Error('VERIFIED_PINNED_CLI_REQUIRED');
  const out=resolve(process.env.IWAY_UAT_DRY_RUN_OUTPUT??'dist/b902-b1000/guarded-dry-run');if(!out.startsWith(resolve('dist')+sep))throw Error('DIST_OUTPUT_REQUIRED');mkdirSync(out,{recursive:true});
  const workspace=out+'/workspace';mkdirSync(workspace);const init=spawnSync(cli,['init','--workdir',workspace],{encoding:'utf8',timeout:30000});if(init.status)throw Error('ISOLATED_CONFIG_INIT_FAILED');
  mkdirSync(workspace+'/supabase/migrations',{recursive:true});for(const file of migrationNames)copyFileSync('supabase/migrations/'+file,workspace+'/supabase/migrations/'+file);
  const r=spawnSync(cli,[...args,'--workdir',workspace],{encoding:'utf8',timeout:90000,maxBuffer:1000000,windowsHide:true});
  const text=(r.stdout??'')+(r.stderr??'');let detail;try{detail=JSON.parse(r.stdout)}catch{}
  const files=[...new Set([...text.matchAll(/\d{14}_[a-z_]+\.sql/g)].map(m=>m[0]))].sort();
  const code=detail?.error?.code;
  const result={status:r.status===0&&JSON.stringify(files)===JSON.stringify([...migrationNames].sort())?'PASS_DRY_RUN_ONLY':'BLOCKED_DRY_RUN',projectId:uatProject,cliVersion,exitCode:r.status,files,manifest,skipVault:true,hostedMigrationsApplied:false,rawOutputRetained:false,errorCode:typeof code==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(code)?code:null,loginRoleEndpoint403:/login role status 403/.test(text)};
  writeFileSync(out+'/receipt.json',JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,files:files.length,loginRoleEndpoint403:result.loginRoleEndpoint403}));if(result.status!=='PASS_DRY_RUN_ONLY')process.exitCode=2;
 }catch(e){console.error(JSON.stringify({status:'BLOCKED',code:/^[A-Z0-9_]+$/.test(e.message)?e.message:'DRY_RUN_FAILED'}));process.exitCode=2;}
}
