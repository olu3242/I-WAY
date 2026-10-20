// B439 disposable fixture: real child-process termination and lease takeover.
// A process exits without releasing its PostgreSQL lease. Another process
// must reclaim only after expiry; stale owner cannot finalize.
import {Client} from 'pg';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createPgNonceCleanupJobs} from '../server/operations-pg-nonce-cleanup-jobs.experimental.mjs';
const invitationId=randomUUID(),tenantId=randomUUID(),actorId=randomUUID(),ownerId=randomUUID();
const client=new Client();
await client.connect();
try{
 await client.query(`INSERT INTO operations_onboarding.invitations
 (id,tenant_id,creator_id,recipient,assignment,issuer,subject_hash,state,expires_at)
 VALUES($1,$2,$3,$4,'{"role":"driver"}','https://fixture.invalid',$5,'VERIFIED',now()+interval '1 hour')`,
 [invitationId,tenantId,actorId,invitationId+'@example.invalid','d'.repeat(64)]);
 const jobs=createPgNonceCleanupJobs((sql,params)=>client.query(sql,params));
 await jobs.enqueue({invitationId,tenantId});
 const childScript=`
 import {Client} from 'pg';
 import {createPgNonceCleanupJobs} from './server/operations-pg-nonce-cleanup-jobs.experimental.mjs';
 const c=new Client();await c.connect();
 const jobs=createPgNonceCleanupJobs((sql,params)=>c.query(sql,params));
 const claimed=await jobs.claim({ownerId:process.env.B439_OWNER,leaseSeconds:30});
 if(claimed.length!==1)process.exit(4);
 process.stdout.write(JSON.stringify(claimed[0])+String.fromCharCode(10));
 setInterval(()=>{},1000);
 `;
 const child=spawn(process.execPath,['--input-type=module','-e',childScript],{
  cwd:process.cwd(),env:{...process.env,B439_OWNER:ownerId},stdio:['ignore','pipe','pipe']
 });
 let stdout='',stderr='';
 const claimed=await new Promise((resolve,reject)=>{
  let settled=false;
  const finish=(error,value)=>{if(settled)return;settled=true;error?reject(error):resolve(value);};
  child.stdout.on('data',data=>{
   stdout+=data.toString();
   if(stdout.includes('\n')){try{finish(null,JSON.parse(stdout.split('\n')[0]));}catch(error){finish(error);}}
  });
  child.stderr.on('data',data=>{stderr+=data.toString();});
  child.on('error',error=>finish(error));
  child.on('exit',code=>finish(Error('B439_CHILD_EXITED_BEFORE_CLAIM_'+code+'_'+stderr.slice(0,200))));
  setTimeout(()=>finish(Error('B439_CHILD_CLAIM_TIMEOUT')),15000).unref();
 });
 try{
  if(claimed.invitationId!==invitationId||claimed.fenceToken<1)
   throw Error('B439_CHILD_LEASE_INVALID');
 }finally{
  child.kill('SIGKILL');
  await new Promise(resolve=>{if(child.exitCode!==null||child.signalCode!==null)return resolve();child.once('exit',resolve);});
 }
 if(!await jobs.ownsFence({invitationId,tenantId,ownerId,fenceToken:claimed.fenceToken}))
  throw Error('B439_CRASH_DID_NOT_PRESERVE_LEASE');
 const replacementOwner=randomUUID();
 if((await jobs.claim({ownerId:replacementOwner})).length!==0)
  throw Error('B439_PREMATURE_LEASE_TAKEOVER');
 await client.query(`UPDATE operations_onboarding.nonce_cleanup_jobs
 SET lease_until=now()-interval '1 second' WHERE invitation_id=$1`,[invitationId]);
 const recovered=await jobs.claim({ownerId:replacementOwner});
 if(recovered.length!==1||recovered[0].fenceToken<=claimed.fenceToken)
  throw Error('B439_RECOVERY_FENCE_NOT_INCREMENTED');
 if(await jobs.ownsFence({invitationId,tenantId,ownerId,fenceToken:claimed.fenceToken}))
  throw Error('B439_STALE_PROCESS_RETAINED_FENCE');
 if(await jobs.finalizeConsumedChallenges({invitationId,tenantId,ownerId,fenceToken:claimed.fenceToken}))
  throw Error('B439_STALE_PROCESS_FINALIZED');
 if(!await jobs.ownsFence({invitationId,tenantId,ownerId:replacementOwner,fenceToken:recovered[0].fenceToken}))
  throw Error('B439_NEW_PROCESS_FENCE_NOT_OWNED');
 // Avoid leaving a pending job that can affect later fixture suites.
 if(!await jobs.complete({invitationId,tenantId,ownerId:replacementOwner}))
  throw Error('B439_FIXTURE_JOB_CLEANUP_FAILED');
 console.log('PASS: B439 real process termination, persistent lease and fenced takeover');
}finally{await client.end();}
