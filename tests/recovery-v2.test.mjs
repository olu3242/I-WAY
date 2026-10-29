import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {assertLabPath,assertLabContainer,backupManifest,copyInventory,copyCompatibility,compareCatalogs,safeRestoreError,sha256,labId} from '../scripts/lib/recovery-v2.mjs';
test('B902 exact V2 path rejects original lab, traversal and other volumes',()=>{
 assert.equal(assertLabPath('C:/IWAY-Recovery-Lab-V2'),'C:\\IWAY-Recovery-Lab-V2');
 for(const p of ['C:/IWAY-Recovery-Lab','C:/IWAY-Recovery-Lab-V2/../IWAY-Recovery-Lab','D:/IWAY-Recovery-Lab-V2','C:/IWAY-Recovery-Lab-V2/other'])assert.throws(()=>assertLabPath(p),/EXACT_V2/);
});
test('B902 database commands require exact container, CLI label and pinned image',()=>{
 const valid={Name:'/supabase_db_'+labId,Config:{Image:'public.ecr.aws/supabase/postgres:17.11.0.006',Labels:{'com.supabase.cli.project':labId}}};assert.equal(assertLabContainer(valid),true);
 for(const patch of [{Name:'/supabase_db_IWAY-Recovery-Lab'},{Config:{...valid.Config,Image:'postgres:latest'}},{Config:{...valid.Config,Labels:{}}}])assert.throws(()=>assertLabContainer({...valid,...patch}));
});
test('B921 original backup bytes and size must match every bound manifest entry',t=>{
 const dir=mkdtempSync(join(tmpdir(),'iway-recovery-integrity-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 for(const p of ['roles.sql','schema.sql','data.sql'])writeFileSync(join(dir,p),'synthetic');
 const rows=['"File","SizeBytes","SHA256"',...['roles.sql','schema.sql','data.sql'].map(p=>'"'+p+'","9","'+sha256('synthetic')+'"')];
 writeFileSync(join(dir,'recovery-hashes.csv'),rows.join('\n'));assert.equal(backupManifest(dir).length,3);
 writeFileSync(join(dir,'data.sql'),'tampered!');assert.throws(()=>backupManifest(dir),/INTEGRITY/);
});
test('B921 backup manifest cannot select paths outside its directory',t=>{
 const dir=mkdtempSync(join(tmpdir(),'iway-recovery-traversal-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 writeFileSync(join(dir,'recovery-hashes.csv'),'header\n"../roles.sql","1","'+sha256('x')+'"');assert.throws(()=>backupManifest(dir),/MANIFEST_INVALID/);
});
test('B921 COPY inventory handles digits and retains counts without row values',()=>{
 const sql='COPY "storage"."s3_multipart_uploads" ("id", "owner_id") FROM stdin;\nprivate-value\tprivate-owner\n\\.\nCOPY "auth"."users" ("id") FROM stdin;\n\\.\n';
 const rows=copyInventory(sql);assert.equal(rows[0].rows,1);assert.equal(rows[1].rows,0);assert.ok(!JSON.stringify(rows).includes('private-'));
});
test('B921 malformed, external and unterminated COPY fail closed',()=>{
 for(const sql of ['COPY auth.users FROM PROGRAM \'x\';','COPY "auth"."users" ("id") FROM stdin;\nsecret','SELECT 1;'])assert.throws(()=>copyInventory(sql));
});
test('B922 original managed schema gaps block restore rather than dropping data sections',()=>{
 const inventory=[{schema:'auth',table:'mfa_recovery_codes',columns:['id'],rows:0},{schema:'auth',table:'one_time_tokens',columns:['expires_at'],rows:0}];
 const c=copyCompatibility(inventory,{columns:[{schema:'auth',table:'one_time_tokens',name:'id'}]});assert.equal(c.status,'BLOCKED_SCHEMA');assert.deepEqual(c.missing,['auth.mfa_recovery_codes','auth.one_time_tokens.expires_at']);
});
test('B922 complete COPY shape is narrower than full managed-service certification',()=>assert.equal(copyCompatibility([{schema:'auth',table:'users',columns:['id']}],{columns:[{schema:'auth',table:'users',name:'id'}]}).status,'PASS_COPY_SHAPE'));
test('B923 schema comparison reports missing constraints and new objects independently',()=>{
 const diff=compareCatalogs({constraints:[{schema:'storage',table:'buckets',name:'guard'}],columns:[{schema:'auth',table:'users',name:'id',type:'uuid'}]}, {constraints:[],columns:[{schema:'auth',table:'users',name:'id',type:'text'}],tables:[{schema:'storage',name:'new'}]});
 assert.deepEqual(diff.constraints.missing,['storage.buckets.guard']);assert.equal(diff.columns.different.length,1);assert.equal(diff.tables.extra.length,1);
});
test('B924 SQLSTATE diagnostics exclude psql context, SQL literals and data rows',()=>{
 const result=safeRestoreError('ERROR: 23503: private@example.invalid\nDETAIL: secret-key\nCONTEXT: COPY users line 1');assert.equal(result.sqlState,'23503');assert.ok(!JSON.stringify(result).includes('secret'));assert.equal(result.rawDiagnosticRetained,false);
});
