import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,readdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {packageUatStaging,deterministicZip} from '../scripts/package-uat-staging.mjs';
import {verifyUatStagingDelivery} from '../scripts/verify-uat-staging-delivery.mjs';

const assets=['admin.html','admin.js','extended.js','i-way-logo.svg','index.html','intelligence.js','login.html','login.js','ops.css','ops.js'];
function git(source,args){return execFileSync('git',args,{cwd:source,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
async function fixture(t,extra={}){
 const source=await mkdtemp(join(tmpdir(),'iway-uat-package-'));t.after(()=>rm(source,{recursive:true,force:true}));
 const sourceFiles={
  '.gitignore':'dist/\n.env*\n',
  'deploy/uat-staging/api/index.mjs':"import {runtime} from '../../../server/fixture-runtime.mjs';\nexport default runtime;\nexport const config={api:{bodyParser:false}};\n",
  'deploy/uat-staging/vercel.json':await readFile(new URL('../deploy/uat-staging/vercel.json',import.meta.url)),
  'server/fixture-runtime.mjs':"import './fixture-nested.mjs';\nconst pg=await import('pg');\nconst worker=await import('./fixture-dynamic.mjs');\nexport const runtime=()=>[pg,worker];\n",
  'server/fixture-nested.mjs':"import{mode}from'../domain/fixture.mjs';\nconst ca=new URL('./certs/supabase-prod-ca-2021.crt',import.meta.url);\n",
  'server/fixture-dynamic.mjs':"export const worker='persisted';\n",
  'domain/fixture.mjs':"export const mode='tenant-scoped';\n",
  'server/certs/supabase-prod-ca-2021.crt':'PUBLIC-CA-FIXTURE\n',
  'package-lock.json':await readFile(new URL('../package-lock.json',import.meta.url)),
  'docs/private-notes.txt':'INTERNAL-NEVER-PACKAGE\n',
  'reference/figma-make-prototype/example.js':'PROTOTYPE-NEVER-PACKAGE\n',
  ...Object.fromEntries(assets.map(name=>['apps/operations/'+name,'asset:'+name+'\n'])),...extra
 };
 for(const [path,content] of Object.entries(sourceFiles)){await mkdir(dirname(join(source,path)),{recursive:true});await writeFile(join(source,path),content);}
 git(source,['init','--quiet']);git(source,['add','.']);git(source,['-c','user.name=IWAY local fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','Synthetic packaging fixture']);
 await writeFile(join(source,'.env.local'),'PRIVATE-FIXTURE-NEVER-PACKAGE\n');
 return {source,commit:git(source,['rev-parse','HEAD'])};
}
function zipNames(bytes){
 const names=[];let cursor=0;
 while(bytes.readUInt32LE(cursor)===0x04034b50){
  const size=bytes.readUInt32LE(cursor+18),nameLength=bytes.readUInt16LE(cursor+26),extra=bytes.readUInt16LE(cursor+28);
  names.push(bytes.subarray(cursor+30,cursor+30+nameLength).toString());cursor+=30+nameLength+extra+size;
 }
 return names;
}
test('B674 immutable package includes static/dynamic/asset/CA closure and reproducible production-only lock',async t=>{
 const context=await fixture(t),first=join(context.source,'dist/first/staging'),second=join(context.source,'dist/second/staging');
 const a=await packageUatStaging({...context,output:first}),b=await packageUatStaging({...context,output:second});
 assert.deepEqual(a,b);const zipA=await readFile(join(first,'../iway-staging-artifact.zip')),zipB=await readFile(join(second,'../iway-staging-artifact.zip'));assert.deepEqual(zipA,zipB);
 const paths=zipNames(zipA);assert.deepEqual(paths,[...paths].sort());
 for(const expected of ['server/fixture-dynamic.mjs','domain/fixture.mjs','server/certs/supabase-prod-ca-2021.crt','api/index.mjs','deploy/uat-staging/api/index.mjs',...assets.map(name=>'apps/operations/'+name)])assert.ok(paths.includes(expected),expected);
 assert.ok(!paths.some(path=>/^(?:docs|reference|site)\/|\.env|node_modules/.test(path)));
 assert.ok(!zipA.includes(Buffer.from('PRIVATE-FIXTURE-NEVER-PACKAGE')));assert.ok(!zipA.includes(Buffer.from('INTERNAL-NEVER-PACKAGE')));
 const manifest=JSON.parse(await readFile(join(first,'package.json'))),lock=JSON.parse(await readFile(join(first,'package-lock.json')));
 assert.deepEqual(Object.keys(manifest.dependencies),['pg']);assert.match(manifest.dependencies.pg,/^\d+\.\d+\.\d+$/);
 assert.ok(Object.keys(lock.packages).length>5);assert.ok(Object.values(lock.packages).every(entry=>!entry.dev));assert.ok(!JSON.stringify(lock).includes('playwright'));
 assert.equal(a.commit,context.commit);assert.equal(a.target,'preview');assert.equal(a.projectId,'prj_7uof3CdmN1QvzKxETkXvHjlrLjVm');assert.equal(git(context.source,['status','--porcelain']),'');
 const binding=JSON.parse(await readFile(join(first,'.vercel/project.json')));assert.equal(binding.projectId,a.projectId);assert.equal(binding.orgId,a.orgId);
});
test('B671 package rejects missing SHA, mismatched HEAD, tracked edits and untracked candidate files',async t=>{
 const context=await fixture(t),output=join(context.source,'dist/rejected/staging');
 await assert.rejects(packageUatStaging({...context,commit:undefined,output}),/EXACT_COMMIT_REQUIRED/);
 await assert.rejects(packageUatStaging({...context,commit:'0'.repeat(40),output}),/HEAD_MISMATCH/);
 await writeFile(join(context.source,'server/fixture-runtime.mjs'),'unreviewed edit');await assert.rejects(packageUatStaging({...context,output}),/CLEAN_WORKTREE_REQUIRED/);
 git(context.source,['restore','server/fixture-runtime.mjs']);await writeFile(join(context.source,'unreviewed.txt'),'new candidate');await assert.rejects(packageUatStaging({...context,output}),/CLEAN_WORKTREE_REQUIRED/);
});
test('B674 committed private dependencies and computed dynamic imports fail closed',async t=>{
 for(const [name,contents,error] of [
  ['private',"import '../docs/private-notes.txt';\nconst pg=await import('pg');",/SOURCE_NOT_ALLOWLISTED/],
  ['computed',"const moduleName='pg';\nconst pg=await import(moduleName);",/NON_LITERAL_IMPORT_REJECTED/],
  ['bare',"import 'unreviewed-package';",/BARE_DEPENDENCY_NOT_ALLOWLISTED/]
 ]){
  const context=await fixture(t,{'server/fixture-runtime.mjs':contents});await assert.rejects(packageUatStaging({...context,output:join(context.source,'dist/'+name+'/staging')}),error);
 }
});
test('B675 package requires isolated disabled-Git config, dist output and empty destination',async t=>{
 const context=await fixture(t);
 await assert.rejects(packageUatStaging({...context,output:join(context.source,'public')}),/OUTSIDE_DIST/);
 const output=join(context.source,'dist/existing/staging');await mkdir(output,{recursive:true});await writeFile(join(output,'existing.txt'),'preserve me');
 await assert.rejects(packageUatStaging({...context,output}),/OUTPUT_MUST_BE_EMPTY/);assert.equal(await readFile(join(output,'existing.txt'),'utf8'),'preserve me');
 const bad=await fixture(t,{'deploy/uat-staging/vercel.json':'{"framework":null,"outputDirectory":"site/public","git":{"deploymentEnabled":true}}'});
 await assert.rejects(packageUatStaging({...bad,output:join(bad.source,'dist/bad/staging')}),/VERCEL_ISOLATION_REQUIRED/);
});
test('B674 deterministic ZIP rejects traversal and sorts records independently of insertion order',()=>{
 const a=deterministicZip(new Map([['z.txt',Buffer.from('z')],['a.txt',Buffer.from('a')]]));
 const b=deterministicZip(new Map([['a.txt',Buffer.from('a')],['z.txt',Buffer.from('z')]]));assert.deepEqual(a,b);assert.deepEqual(zipNames(a),['a.txt','z.txt']);
 assert.throws(()=>deterministicZip(new Map([['../private',Buffer.from('x')]])),/PATH_REJECTED/);
});
test('B674 complete candidate runtime closure packages and imports without repository-relative gaps',async t=>{
 // A synthetic Git commit of allowlisted code validates the current candidate before
 // its final review commit. This fixture is never labeled as the release artifact.
 const sourceRoot=fileURLToPath(new URL('..',import.meta.url)),extra={};
 async function codeFiles(directory){
  for(const entry of await readdir(join(sourceRoot,directory),{withFileTypes:true})){
   const path=directory+'/'+entry.name;
   if(entry.isDirectory())await codeFiles(path);
   else if(/\.(?:mjs|crt)$/.test(entry.name))extra[path]=await readFile(join(sourceRoot,path));
  }
 }
 await codeFiles('server');await codeFiles('domain');
 for(const path of ['deploy/uat-staging/api/index.mjs','lib/intelligence/policy-lifecycle.mjs','lib/intelligence/decision-plane.mjs',...assets.map(name=>'apps/operations/'+name)])extra[path]=await readFile(join(sourceRoot,path));
 const context=await fixture(t,extra),output=join(context.source,'dist/complete/staging'),manifest=await packageUatStaging({...context,output});
 for(const path of ['server/operations-uat-hosted-runtime.mjs','server/operations-durable-postgres.mjs','server/operations-durable-uat.mjs','server/operations-app.mjs','domain/operations.mjs'])assert.ok(manifest.files[path],path);
 assert.ok(Object.keys(manifest.files).length>60);
 const entrypoint=await import(pathToFileURL(join(output,'api/index.mjs')).href);assert.equal(typeof entrypoint.default,'function');assert.equal(entrypoint.config.api.bodyParser,false);
});
test('B671 delivery verifier binds exact SHA/archive/files/project and only returns an approval-required plan',async t=>{
 const context=await fixture(t),directory=join(context.source,'dist/delivery/staging');await packageUatStaging({...context,output:directory});
 const plan=await verifyUatStagingDelivery({directory,commit:context.commit,env:{}});assert.equal(plan.status,'APPROVAL_REQUIRED');assert.equal(plan.deployExecuted,false);assert.equal(plan.gitPush,false);assert.equal(plan.workingDirectory,directory);
 for(const patch of [{target:'production'},{env:{VERCEL_PROJECT_ID:'prj_0vutnbiNCYaxhdrbLfktrsHAvxty'}},{env:{VERCEL_ORG_ID:'wrong-team'}},{env:{VERCEL_ENV:'production'}},{commit:'0'.repeat(40)}])await assert.rejects(verifyUatStagingDelivery({directory,commit:context.commit,env:{},...patch}));
 await writeFile(join(directory,'.env.local'),'must not be delivered');await assert.rejects(verifyUatStagingDelivery({directory,commit:context.commit,env:{}}),/FILE_MANIFEST_MISMATCH/);await rm(join(directory,'.env.local'));
 await writeFile(join(directory,'server/fixture-dynamic.mjs'),'tampered');await assert.rejects(verifyUatStagingDelivery({directory,commit:context.commit,env:{}}),/FILE_CHECKSUM_MISMATCH/);
});
test('B674 delivery verifier detects changed archive independently of extracted file checks',async t=>{
 const context=await fixture(t),directory=join(context.source,'dist/archive/staging');await packageUatStaging({...context,output:directory});
 await writeFile(join(directory,'../iway-staging-artifact.zip'),'tampered');await assert.rejects(verifyUatStagingDelivery({directory,commit:context.commit,env:{}}),/ARCHIVE_CHECKSUM_MISMATCH/);
});
