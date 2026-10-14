import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {setTimeout as delay} from 'node:timers/promises';
import {fixture,password} from '../tests/helpers/operations-fixture.mjs';
import {createOperationsFeatures} from '../domain/operations-features.mjs';
import {Operations} from '../domain/operations.mjs';
import {runRuntimeTick} from '../domain/operations-runtime.mjs';
import {OperationsStore} from '../server/operations-store.mjs';
import {authenticate} from '../server/operations-auth.mjs';
import {backupOperations,restoreOperations} from '../server/operations-recovery.mjs';

const prefixDigest=(store,sequence)=>createHash('sha256').update(JSON.stringify(store.db.prepare('SELECT sequence,id,tenant_id,actor_id,action,resource_id,at,outcome,detail FROM audit WHERE sequence<=? ORDER BY sequence').all(sequence))).digest('hex');
export async function rehearseRecovery({outputPath}={}){
 const cleanup=[],f=await fixture({after:callback=>cleanup.push(callback)},createOperationsFeatures());let recovered;
 try{
  const load=f.createLoad(),job=f.command(f.manager,'orchestration:request',load);
  authenticate(f.store,f.manager.username,password);
  const originalSequence=f.store.db.prepare('SELECT max(sequence) AS value FROM audit').get().value,auditDigest=prefixDigest(f.store,originalSequence);
  const backup=await backupOperations({sourcePath:f.path,backupDirectory:join(f.root,'backup')});
  await delay(20);const lost=f.createLoad(),failureAt=new Date().toISOString(),failureStarted=performance.now();
  const sourceAuditSequenceAtFailure=f.store.db.prepare('SELECT max(sequence) AS value FROM audit').get().value;
  const restore=await restoreOperations({backupDirectory:join(f.root,'backup'),targetDirectory:join(f.root,'restored'),expectedManifestSha256:backup.manifestSha256});
  recovered=new OperationsStore(join(f.root,'restored','operations.sqlite'));const operations=new Operations(recovered,createOperationsFeatures());
  const auditPrefixPreserved=prefixDigest(recovered,originalSequence)===auditDigest;
  const lostAbsent=!recovered.list('load',f.manager.tenantId).some(l=>l.id===lost.id);
  for(let step=0;step<5;step++)await runRuntimeTick(operations);
  const recoveredJob=recovered.get('orchestration',job.id,f.manager.tenantId),sessions=recovered.db.prepare('SELECT count(*) AS n FROM sessions').get().n;
  const observedRtoMs=performance.now()-failureStarted,observedRpoMs=Math.max(0,Date.parse(failureAt)-Date.parse(backup.lastRecoverableAuditAt));
  const checks={integrity:restore.integrity==='ok',auditPrefixPreserved,postSnapshotFixtureLoadAbsent:lostAbsent,recoveredWorkflowCompleted:recoveredJob.status==='completed'&&recoveredJob.checkpoint===5,restoredSessionsRevoked:sessions===0&&restore.sessionsRevoked===1,sourcePreserved:f.store.list('load',f.manager.tenantId).some(l=>l.id===lost.id)};
  const report={format:'iway-recovery-evidence',version:1,status:Object.values(checks).every(Boolean)&&observedRtoMs<=10000?'PASS':'FAIL',capturedAt:new Date().toISOString(),
   scope:'Isolated local SQLite rehearsal; not hosted disaster-recovery certification',runtime:{node:process.version,platform:process.platform},backupDurationMs:backup.backupDurationMs,restoreDurationMs:restore.restoreDurationMs,
   observedRpoMs,observedRtoMs,measurementDefinitions:{rpo:'Simulated failure timestamp minus latest recoverable audit timestamp; one deliberately committed post-snapshot load is absent.',rto:'Simulated failure to verified restore, audit-prefix validation, session revocation, and completion of a recovered five-checkpoint advisory workflow.'},
   backupBytes:backup.databaseBytes,manifestSha256:backup.manifestSha256,sourceAuditSequenceAtFailure,recoveredAuditSequence:restore.recoveredAuditSequence,lostAuditEvents:sourceAuditSequenceAtFailure-restore.recoveredAuditSequence,
   checks,budgets:{localRehearsalRtoMs:10000,expectedLostPostSnapshotFixtureLoads:1},hostedCertified:false};
  if(outputPath){await mkdir(dirname(resolve(outputPath)),{recursive:true});await writeFile(outputPath,JSON.stringify(report,null,2)+'\n');}
  return report;
 }finally{recovered?.close();for(const callback of cleanup)await callback()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const outputPath=process.argv[2]??'dist/operations-evidence/recovery.json';
 rehearseRecovery({outputPath}).then(report=>{console.log(JSON.stringify(report));if(report.status!=='PASS')process.exitCode=1}).catch(()=>{console.error(JSON.stringify({status:'FAIL',error:'Isolated recovery rehearsal did not complete.'}));process.exitCode=1});
}
