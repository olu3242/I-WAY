// Separate management plane. Never imported by the application runtime or artifact.
// Approval, administrator client and confidential transport are injected by an owner.
import {createHash,randomUUID} from 'node:crypto';
import {createUatWorkflow,validateUatRoster} from './operations-uat-workflow.mjs';
import {createUatRecoveryIssuer,verifiedGoogleSubjects} from './operations-uat-provider.mjs';
const projectId='prj_7uof3CdmN1QvzKxETkXvHjlrLjVm';
const projectOrigin='https://vnoxdinldneeczxibicp.supabase.co';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const hash=value=>createHash('sha256').update(value).digest('hex');
const deny=()=>{throw Error('UAT_MANAGEMENT_DENIED');};
async function bounded(fn,timeoutMs){
 const controller=new AbortController();let timer;
 try{return await Promise.race([Promise.resolve().then(()=>fn(controller.signal)),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('UAT_MANAGEMENT_TIMEOUT'));},timeoutMs);})]);}
 finally{clearTimeout(timer);}
}
export function uatRosterDigest(roster){
 const entries=validateUatRoster(roster);
 return hash(JSON.stringify([...entries].sort((a,b)=>a.role.localeCompare(b.role)).map(e=>[e.role,e.email,e.userId,e.googleSubject,e.principalId,e.tenantId,e.fleetId,[...e.permissions].sort()])));
}
function approvedOrigin(value){
 try{const u=new URL(value);if(u.protocol==='https:'&&u.origin===value&&!u.username&&!u.password)return value;}catch{}
 deny();
}
// Transport owns provider credentials; this adapter never logs, persists or returns links.
export function createConfidentialUatDelivery({origin,send,authorizeDelivery=async()=>false,timeoutMs=8000}={}){
 return async function deliver({entry,token,purpose,requestId}){
  if(typeof send!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>8000||!await authorizeDelivery()||!['setup','recovery'].includes(purpose)||!uuid(requestId)||!entry?.email||!/^[A-Za-z0-9_-]{43}$/.test(token))deny();
  const url=approvedOrigin(origin)+'/uat/setup#'+token;
  try{
   const result=await bounded(signal=>send({to:entry.email,subject:'I-WAY UAT password setup',text:'Use your one-time I-WAY UAT password setup link: '+url,idempotencyKey:requestId,signal}),timeoutMs);
   if(result?.accepted!==true)throw Error();
   return {ok:true};
  }catch{throw Error('UAT_CONFIDENTIAL_DELIVERY_UNAVAILABLE');}
 };
}
export function createUatManagementPlane({workflowDependencies,commandStore,getApproval=async()=>null,adminClient,send,clock=()=>Date.now()}={}){
 const roster=validateUatRoster(workflowDependencies?.roster),rosterDigest=uatRosterDigest(roster);
 if(!commandStore||!['claim','complete','uncertain'].every(k=>typeof commandStore[k]==='function'))throw Error('UAT_MANAGEMENT_STORE_REQUIRED');
 const lookup=id=>roster.find(e=>e.userId===id);
 async function authority(adminSession,entry,operation){
  const a=await getApproval();
  if(!a||a.status!=='approved'||!uuid(a.id)||a.projectId!==projectId||a.rosterDigest!==rosterDigest||!Number.isSafeInteger(a.notBefore)||!Number.isSafeInteger(a.expiresAt)||a.notBefore>clock()||a.expiresAt<=clock()||a.expiresAt-a.notBefore>86400000||!a.operations?.includes(operation))deny();
  approvedOrigin(a.origin);
  const actor=await workflowDependencies.authenticateAdministrator(adminSession);
  if(!uuid(actor?.id)||!actor.active||actor.assurance!=='aal2'||!actor.permissions?.includes('platform:invite')||!a.actorIds?.includes(actor.id)||!await workflowDependencies.authorizeIssuance({actor,entry}))deny();
  return {approval:a,actor};
 }
 function existingIdentity(user,entry){
  if(!user||user.id!==entry.userId||user.email!==entry.email||!user.email_confirmed_at||user.is_anonymous===true||user.banned_until&&Date.parse(user.banned_until)>clock()||!verifiedGoogleSubjects(user).includes(entry.googleSubject))deny();
 }
 async function verifyMembership(entry,operation){
  const membership=await workflowDependencies.lookupMembership(entry.userId);
  if(!membership?.active||membership.revoked||membership.role!==entry.role||membership.principalId!==entry.principalId||membership.tenantId!==entry.tenantId||membership.fleetId!==entry.fleetId||entry.role!=='platform'&&membership.tenantActive!==true||JSON.stringify([...(membership.permissions??[])].sort())!==JSON.stringify([...entry.permissions].sort()))deny();
  if(operation!=='revoke'&&!(await workflowDependencies.store.state(entry.userId))?.active)deny();
 }
 async function execute({adminSession,userId,operation,ttlSeconds=3600,idempotencyKey}={}){
  const entry=lookup(userId);if(!entry||!uuid(idempotencyKey)||!['setup','recovery','revoke'].includes(operation)||!Number.isInteger(ttlSeconds)||ttlSeconds<60||ttlSeconds>86400)deny();
  const initial=await authority(adminSession,entry,operation),key=hash(initial.actor.id+':'+idempotencyKey);
  if(operation!=='revoke'&&(typeof send!=='function'||adminClient?.supabaseUrl!==projectOrigin||typeof adminClient?.auth?.admin?.getUserById!=='function'||typeof adminClient?.auth?.admin?.generateLink!=='function'))deny();
  const fingerprint=hash(JSON.stringify([userId,operation,ttlSeconds,rosterDigest,initial.approval.id,initial.approval.origin]));
  // Recheck current membership before claiming or calling privileged provider APIs.
  await verifyMembership(entry,operation);
  const claim=await commandStore.claim({key,fingerprint,actorId:initial.actor.id,userId,nonce:randomUUID(),expires:clock()+60000,now:clock()});
  if(claim.status==='completed')return {ok:true,replayed:true,operation};
  if(claim.status!=='claimed')throw Error('UAT_MANAGEMENT_COMMAND_FENCED');
  const recheck=async()=>{
   const current=await authority(adminSession,entry,operation);
   if(current.actor.id!==initial.actor.id||current.approval.id!==initial.approval.id||current.approval.origin!==initial.approval.origin||clock()>=claim.expires)deny();
   await verifyMembership(entry,operation);
   return true;
  };
  let started=false;
  try{
   await recheck();
   const issuer={async generateRecovery(){
    await recheck();
    if(adminClient?.supabaseUrl!==projectOrigin||typeof adminClient?.auth?.admin?.getUserById!=='function'||typeof adminClient?.auth?.admin?.generateLink!=='function')deny();
    try{
     const {data,error}=await bounded(()=>adminClient.auth.admin.getUserById(entry.userId),8000);if(error)deny();existingIdentity(data?.user,entry);
     await recheck();
     const result=await bounded(()=>createUatRecoveryIssuer({adminClient}).generateRecovery({email:entry.email,userId:entry.userId}),8000);
     await recheck();return result;
    }catch{throw Error('UAT_MANAGEMENT_ISSUER_UNAVAILABLE');}
   }};
   const delivery=createConfidentialUatDelivery({origin:initial.approval.origin,send,authorizeDelivery:recheck});
   const workflow=createUatWorkflow({...workflowDependencies,issuer,deliver:async message=>{
    if(message.email!==entry.email||message.purpose!==operation)deny();
    return delivery({entry,token:message.token,purpose:message.purpose,requestId:claim.nonce});
   }});
   if(operation==='revoke'){started=true;await workflow.revoke({adminSession,userId});}
   else{
    // Missing transport must fail before provider generation or state mutation.
    if(typeof send!=='function'||adminClient?.supabaseUrl!==projectOrigin)deny();
    started=true;await workflow.issue({adminSession,userId,purpose:operation,ttlSeconds});
   }
   await recheck();
   if(!await commandStore.complete({...claim,key,actorId:initial.actor.id,now:clock()}))throw Error();
   return {ok:true,replayed:false,operation};
  }catch{
   // Never retry a possibly delivered message. Quarantine until owner reconciliation.
   if(started)await Promise.resolve().then(()=>workflowDependencies.store.revoke(userId,{actorId:initial.actor.id})).catch(()=>{});
   await commandStore.uncertain({...claim,key,actorId:initial.actor.id,now:clock()}).catch(()=>{});
   throw Error('UAT_MANAGEMENT_OUTCOME_UNCERTAIN');
  }
 }
 const safe=async args=>{try{return await execute(args);}catch{throw Error('UAT_MANAGEMENT_REJECTED');}};
 return Object.freeze({issue:args=>['setup','recovery'].includes(args?.purpose??'setup')?safe({...args,operation:args?.purpose??'setup'}):Promise.reject(Error('UAT_MANAGEMENT_REJECTED')),revoke:args=>safe({...args,operation:'revoke'})});
}
