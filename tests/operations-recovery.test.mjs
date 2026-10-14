import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {fixture,password} from './helpers/operations-fixture.mjs';
import {authenticate} from '../server/operations-auth.mjs';
import {backupOperations,restoreOperations} from '../server/operations-recovery.mjs';
import {rehearseRecovery} from '../scripts/operations-recovery-rehearsal.mjs';

test('measured local recovery preserves audit history, revokes sessions and resumes persisted checkpoints',async()=>{
 const report=await rehearseRecovery();
<<<<<<< HEAD
 assert.equal(report.status,'PASS',JSON.stringify(report));assert.ok(Object.values(report.checks).every(Boolean));
=======
 assert.equal(report.status,'PASS');assert.ok(Object.values(report.checks).every(Boolean));
>>>>>>> origin/feat/fcc-03-batches-2-11-driver-offline
 assert.ok(report.observedRpoMs>=20);assert.ok(report.observedRtoMs>0);assert.ok(report.restoreDurationMs>0);assert.equal(report.lostAuditEvents,2);
 assert.equal(report.hostedCertified,false);assert.equal(report.recoveredAuditSequence,report.sourceAuditSequenceAtFailure-2);
});

test('online backup includes a concurrently committed WAL transaction and authenticates its snapshot',async t=>{
 const f=await fixture(t);f.createLoad();let concurrent;
 const result=await backupOperations({sourcePath:f.path,backupDirectory:join(f.root,'online'),pagesPerStep:1,onProgress:progress=>{
  if(!concurrent&&progress.remainingPages>0)concurrent=f.createLoad();
 }});
 assert.ok(concurrent);assert.equal(result.integrity,'ok');
 const copy=new DatabaseSync(join(f.root,'online','operations.sqlite'),{readOnly:true});
 try{
  const restored=copy.prepare("SELECT data FROM resources WHERE kind='load' AND id=?").get(concurrent.id);
  assert.ok(restored);assert.equal(JSON.parse(restored.data).status,'draft');
 }finally{copy.close()}
 const file=await lstat(join(f.root,'online','operations.sqlite'));assert.ok(file.isFile());
 const manifest=JSON.parse(await readFile(join(f.root,'online','manifest.json'),'utf8'));
 assert.equal(manifest.inspection.integrity,'ok');assert.equal(manifest.inspection.foreignKeyViolations,0);assert.equal(manifest.databaseBytes,file.size);
});

test('backup and restore refuse existing targets without changing their contents or the source',async t=>{
 const f=await fixture(t);f.createLoad();const count=f.store.db.prepare('SELECT count(*) AS n FROM audit').get().n;
 const existing=join(f.root,'existing');await mkdir(existing);await writeFile(join(existing,'keep.txt'),'keep this file');
 await assert.rejects(()=>backupOperations({sourcePath:f.path,backupDirectory:existing}),e=>e.code==='TARGET_EXISTS');
 const result=await backupOperations({sourcePath:f.path,backupDirectory:join(f.root,'backup')});
 await assert.rejects(()=>restoreOperations({backupDirectory:join(f.root,'backup'),targetDirectory:existing,expectedManifestSha256:result.manifestSha256}),e=>e.code==='TARGET_EXISTS');
 assert.equal(await readFile(join(existing,'keep.txt'),'utf8'),'keep this file');assert.equal(f.store.db.prepare('SELECT count(*) AS n FROM audit').get().n,count);
});

test('restore rejects tampered manifests, incorrect external digests and corrupted database bytes',async t=>{
 const f=await fixture(t),backupDirectory=join(f.root,'backup'),result=await backupOperations({sourcePath:f.path,backupDirectory});
 await assert.rejects(()=>restoreOperations({backupDirectory,targetDirectory:join(f.root,'wrong-digest'),expectedManifestSha256:'0'.repeat(64)}),e=>e.code==='MANIFEST_HASH');
 const manifestPath=join(backupDirectory,'manifest.json'),manifest=await readFile(manifestPath,'utf8');
 await writeFile(manifestPath,manifest.replace('"version": 1','"version": 2'));
 await assert.rejects(()=>restoreOperations({backupDirectory,targetDirectory:join(f.root,'tampered-manifest'),expectedManifestSha256:result.manifestSha256}),e=>e.code==='MANIFEST_HASH');
 await writeFile(manifestPath,manifest);
 const databasePath=join(backupDirectory,'operations.sqlite'),database=await readFile(databasePath);database[database.length-1]^=1;await writeFile(databasePath,database);
 await assert.rejects(()=>restoreOperations({backupDirectory,targetDirectory:join(f.root,'corrupt-copy'),expectedManifestSha256:result.manifestSha256}),e=>e.code==='DATABASE_HASH');
});

test('unsupported database backups fail closed and command-line tools emit only sanitized evidence',async t=>{
 const f=await fixture(t),wrong=join(f.root,'not-operations.sqlite'),db=new DatabaseSync(wrong);db.exec('CREATE TABLE other(id INTEGER)');db.close();
 await assert.rejects(()=>backupOperations({sourcePath:wrong,backupDirectory:join(f.root,'unsupported')}),e=>e.code==='SCHEMA');
 const run=args=>new Promise((accept,reject)=>{
  const child=spawn(process.execPath,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});let output='',errors='';
  child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>errors+=d);child.on('error',reject);child.on('close',code=>accept({code,output,errors}));
 });
 authenticate(f.store,f.manager.username,password);
 const backup=await run(['scripts/operations-backup.mjs',f.path,join(f.root,'cli-backup')]);assert.equal(backup.code,0);
 const result=JSON.parse(backup.output);assert.equal(result.status,'PASS');assert.ok(!backup.output.includes(f.manager.username));assert.ok(!backup.output.includes(f.path));
 const restore=await run(['scripts/operations-restore.mjs',join(f.root,'cli-backup'),join(f.root,'cli-restored'),result.manifestSha256]);
 assert.equal(restore.code,0);assert.equal(JSON.parse(restore.output).status,'PASS');assert.equal(restore.errors,'');
 const restored=new DatabaseSync(join(f.root,'cli-restored','operations.sqlite'),{readOnly:true});
 try{assert.equal(restored.prepare('SELECT count(*) AS n FROM sessions').get().n,0);assert.equal(restored.prepare('SELECT count(*) AS n FROM session_security').get().n,0);assert.deepEqual(restored.prepare('PRAGMA foreign_key_check').all(),[])}finally{restored.close()}
 assert.equal(f.store.db.prepare('SELECT count(*) AS n FROM session_security').get().n,1);
});
