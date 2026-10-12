import {createHmac,createHash,timingSafeEqual,randomUUID} from 'node:crypto';
import {authorize} from './authorization.mjs';
import {fields,text,requireValue,integer,OpsError} from './operations-errors.mjs';
import {normalizeLogisticsEvent} from './operations-interoperability.mjs';
const digest=value=>createHash('sha256').update(value).digest('hex');
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const wire=value=>JSON.stringify(canonical(value));
const id=value=>{const result=text(value,100);requireValue(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(result),'INTEGRATION_IDENTIFIER','Invalid integration identifier.');return result;};
const service=tenantId=>({id:'local-integration-service',tenantId,role:'automation',active:true,permissions:[]});
const safeCode=error=>error?.code==='INTEGRATION_TIMEOUT'?'INTEGRATION_TIMEOUT':error?.code==='INTEGRATION_RESULT'?'INTEGRATION_RESULT':'INTEGRATION_DELIVERY_FAILED';
export const localSignedMessageAdapter=Object.freeze({mode:'local-only',provider:'local-signed-fixture',version:'1',deliver:async()=>({status:'local_recorded',externalDelivery:false})});
function providerFor(providers,providerId,tenantId){
 const provider=providers.find(item=>item.id===providerId&&item.tenantId===tenantId&&item.active!==false);
 requireValue(provider?.mode==='local-fixture'&&typeof provider.id==='string'&&/^[a-z0-9-]{1,40}$/.test(provider.id),'INTEGRATION_PROVIDER','An authorized local fixture provider is required.',403);
 requireValue(provider.keys&&Object.keys(provider.keys).length>0&&Object.keys(provider.keys).every(key=>/^[A-Za-z0-9_-]{1,40}$/.test(key)&&Buffer.isBuffer(provider.keys[key])&&provider.keys[key].length>=32&&provider.keys[key].length<=128),'INTEGRATION_KEY_CONFIG','Local fixture signing keys must be configured securely.',503);
 const adapter=provider.adapter??localSignedMessageAdapter;
 requireValue(adapter.mode==='local-only'&&typeof adapter.deliver==='function'&&/^[a-z0-9-]{1,40}$/.test(adapter.provider??'')&&/^[A-Za-z0-9.-]{1,30}$/.test(adapter.version??''),'INTEGRATION_ADAPTER','Only a server-configured local adapter is allowed.',503);
 return {...provider,adapter};
}
const signatureInput=envelope=>['iway-v1',envelope.providerId,envelope.keyId,envelope.timestamp,envelope.eventId,envelope.body].join('\n');
export function signFixtureEnvelope(provider,event,{timestamp=Date.now(),keyId=Object.keys(provider.keys??{})[0]}={}){
 const trusted=providerFor([provider],provider.id,provider.tenantId);id(event.externalId);integer(timestamp,0,Number.MAX_SAFE_INTEGER);
 requireValue(Buffer.isBuffer(trusted.keys[keyId]),'INTEGRATION_KEY_CONFIG','Signing key is unavailable.',503);
 const envelope={providerId:trusted.id,keyId,timestamp,eventId:event.externalId,body:wire(event)};
 requireValue(Buffer.byteLength(envelope.body)<=16384,'INTEGRATION_BODY','Fixture message exceeds the supported bound.');
 return {...envelope,signature:createHmac('sha256',trusted.keys[keyId]).update(signatureInput(envelope)).digest('hex')};
}
export function verifyIntegrationEnvelope(providers,actor,envelope,now){
 fields(envelope,['providerId','keyId','timestamp','eventId','body','signature']);
 const provider=providerFor(providers,id(envelope.providerId),actor.tenantId);
 requireValue(Number.isSafeInteger(envelope.timestamp)&&Math.abs(now-envelope.timestamp)<=300000&&envelope.timestamp<=now+30000,'INTEGRATION_EXPIRED','Message signing time is outside the accepted window.',401);
 requireValue(typeof envelope.body==='string'&&Buffer.byteLength(envelope.body)<=16384&&typeof envelope.signature==='string'&&/^[a-f0-9]{64}$/.test(envelope.signature)&&typeof envelope.keyId==='string'&&Buffer.isBuffer(provider.keys[envelope.keyId]),'INTEGRATION_SIGNATURE','Message signature is invalid.',401);
 id(envelope.eventId);
 const expected=createHmac('sha256',provider.keys[envelope.keyId]).update(signatureInput(envelope)).digest();
 requireValue(timingSafeEqual(expected,Buffer.from(envelope.signature,'hex')),'INTEGRATION_SIGNATURE','Message signature is invalid.',401);
 let event;try{event=JSON.parse(envelope.body)}catch{throw new OpsError(422,'INTEGRATION_BODY','Message body is invalid JSON.');}
 requireValue(event?.externalId===envelope.eventId,'INTEGRATION_EVENT','Envelope and event identifiers must match.');
 return {provider,event,eventHash:digest(wire(event))};
}
function audit(ops,actor,action,record,detail={}){ops.store.audit(actor,action,record.id,'success',{loadId:record.loadId??null,providerId:record.providerId,status:record.status,...detail},ops.now().toISOString());return record;}
function change(ops,record,patch,action,detail={}){const next=ops.store.update(record.kind,record.id,record.tenantId,record.version,patch);return audit(ops,service(record.tenantId),action,next,detail);}
function access(ops,actor,load){policyGuard(ops,actor.tenantId);requireValue(['carrier','dispatcher'].includes(actor.role),'INTEGRATION_AUTHORITY','A human operations principal is required.',403);ops.guard(actor,'connector:request',load);ops.guard(actor,'load:view',load);}
function policyAllows(ops,tenantId){const current=ops.store.list('governancepolicy',tenantId)[0];return !current||current.enabled===true&&!current.disabledTools.includes('connector:logistics');}
function policyGuard(ops,tenantId){requireValue(policyAllows(ops,tenantId),'POLICY_BLOCKED','The carrier policy blocks logistics integrations.',409);}
function authorized(ops,job){
 const actor=ops.store.principal(job.requestedBy),load=ops.store.list('load',job.tenantId).find(item=>item.id===job.loadId);
 if(!(actor?.active&&['carrier','dispatcher'].includes(actor.role)&&load&&authorize({actor,action:'connector:request',resource:load})&&authorize({actor,action:'load:view',resource:load})&&load.version===job.loadVersion))return null;
 try{normalizeLogisticsEvent(ops,actor,load,{schemaVersion:job.event.schemaVersion,externalId:job.event.externalId,type:job.event.type,occurredAt:job.event.occurredAt,data:job.event.data});return {actor,load}}catch{return null}
}
function circuit(ops,tenantId,providerId){return ops.store.list('integrationcircuit',tenantId).find(item=>item.providerId===providerId)??ops.store.insert('integrationcircuit',tenantId,{providerId,status:'closed',failures:0,openUntil:null,probeJobId:null,probeUntil:null});}
export function createIntegrationExtensions({providers=[]}={}){return {
 'integration:ingest':(ops,actor,c)=>{
  fields(c.payload??{},['envelope']);const load=ops.read('load',c.resourceId,actor);access(ops,actor,load);ops.version(load,c.expectedVersion);
  const verified=verifyIntegrationEnvelope(providers,actor,c.payload.envelope,ops.now().getTime()),event=normalizeLogisticsEvent(ops,actor,load,verified.event);
  const existing=ops.store.list('integrationreceipt',actor.tenantId).find(item=>item.providerId===verified.provider.id&&item.eventId===event.externalId);
  if(existing){requireValue(existing.eventHash===verified.eventHash&&existing.loadId===load.id,'INTEGRATION_REPLAY','Event identifier was reused with different evidence.',409);return existing;}
  const receipt=ops.store.insert('integrationreceipt',actor.tenantId,{loadId:load.id,providerId:verified.provider.id,eventId:event.externalId,eventHash:verified.eventHash,event,status:'evidence_recorded',signatureVerified:true,signatureKeyId:c.payload.envelope.keyId,receivedAt:ops.now().toISOString(),live:false});
  return audit(ops,actor,c.action,receipt,{eventType:event.type,eventHash:receipt.eventHash,signatureVerified:true});
 },
 'integration:queue':(ops,actor,c)=>{
  const p=c.payload??{};fields(p,['providerId','event']);const load=ops.read('load',c.resourceId,actor);access(ops,actor,load);ops.version(load,c.expectedVersion);
  const provider=providerFor(providers,id(p.providerId),actor.tenantId),event=normalizeLogisticsEvent(ops,actor,load,p.event),eventHash=digest(wire(event));
  const existing=ops.store.list('integrationjob',actor.tenantId).find(item=>item.providerId===provider.id&&item.eventId===event.externalId);
  if(existing){requireValue(existing.eventHash===eventHash&&existing.loadId===load.id,'INTEGRATION_REPLAY','Event identifier was reused with different evidence.',409);return existing;}
  const job=ops.store.insert('integrationjob',actor.tenantId,{loadId:load.id,loadVersion:load.version,providerId:provider.id,eventId:event.externalId,eventHash,event,requestedBy:actor.id,status:'pending',attempts:0,fence:0,leaseOwner:null,leaseUntil:null,nextAttemptAt:null,lastError:null,createdAt:ops.now().toISOString(),externalDelivery:false});
  return audit(ops,actor,c.action,job,{eventType:event.type,eventHash});
 },
 'integration:retry':(ops,actor,c)=>{
  fields(c.payload??{},['reason']);text(c.payload.reason,300);const job=ops.read('integrationjob',c.resourceId,actor),load=ops.read('load',job.loadId,actor);access(ops,actor,load);ops.version(job,c.expectedVersion);
  requireValue(['dead_letter','blocked'].includes(job.status),'INTEGRATION_STATE','Only blocked or dead-letter work can be reauthorized.',409);providerFor(providers,job.providerId,actor.tenantId);
  normalizeLogisticsEvent(ops,actor,load,{schemaVersion:job.event.schemaVersion,externalId:job.event.externalId,type:job.event.type,occurredAt:job.event.occurredAt,data:job.event.data});
  const next=ops.store.update(job.kind,job.id,job.tenantId,job.version,{status:'pending',loadVersion:load.version,requestedBy:actor.id,attempts:0,fence:job.fence+1,leaseOwner:null,leaseUntil:null,nextAttemptAt:null,lastError:null});
  return audit(ops,actor,c.action,next,{reasonRecorded:true});
 },
 'integration:reset':(ops,actor,c)=>{
  fields(c.payload??{},['reason']);text(c.payload.reason,300);const record=ops.read('integrationcircuit',c.resourceId,actor);ops.guard(actor,'governance:manage',{tenantId:actor.tenantId});ops.version(record,c.expectedVersion);
  requireValue(actor.role==='carrier','INTEGRATION_AUTHORITY','Carrier governance approval is required.',403);
  const next=ops.store.update(record.kind,record.id,record.tenantId,record.version,{status:'closed',failures:0,openUntil:null,probeJobId:null,probeUntil:null});
  return audit(ops,actor,c.action,next,{reasonRecorded:true});
 }
};}
export function claimIntegration(ops,{tenantId,jobId,workerId,providers=[],leaseMs=30000}){
 integer(leaseMs,100,60000);id(workerId);
 return ops.store.transaction(()=>{
  let job=ops.store.get('integrationjob',jobId,tenantId);const now=ops.now().toISOString();
  if(['completed','blocked','dead_letter'].includes(job.status)||job.status==='running'&&job.leaseUntil>now||job.status==='retry'&&job.nextAttemptAt>now)return null;
  if(!policyAllows(ops,job.tenantId)){change(ops,job,{status:'blocked',lastError:'POLICY_BLOCKED',fence:job.fence+1,leaseOwner:null,leaseUntil:null},'integration:blocked');return null;}
  if(!authorized(ops,job)){change(ops,job,{status:'blocked',lastError:'AUTHORITY_CHANGED',fence:job.fence+1,leaseOwner:null,leaseUntil:null},'integration:blocked');return null;}
  let provider;try{provider=providerFor(providers,job.providerId,tenantId)}catch{change(ops,job,{status:'blocked',lastError:'PROVIDER_UNAVAILABLE'},'integration:blocked');return null;}
  let breaker=circuit(ops,tenantId,provider.id);
  if(breaker.status==='open'&&breaker.openUntil>now||breaker.status==='half_open'&&breaker.probeUntil>now)return null;
  if(job.attempts>=3){change(ops,job,{status:'dead_letter',lastError:'ATTEMPTS_EXHAUSTED',leaseOwner:null,leaseUntil:null},'integration:deadletter');return null;}
  const leaseUntil=new Date(ops.now().getTime()+leaseMs).toISOString();
  if(breaker.status!=='closed')breaker=change(ops,breaker,{status:'half_open',probeJobId:job.id,probeUntil:leaseUntil},'integration:probe');
  job=change(ops,job,{status:'running',attempts:job.attempts+1,fence:job.fence+1,leaseOwner:workerId,leaseUntil,adapterBinding:{provider:provider.adapter.provider,version:provider.adapter.version,mode:'local-only'}},'integration:claim');
  return {tenantId,jobId,workerId,fence:job.fence};
 });
}
function held(ops,claim){const job=ops.store.get('integrationjob',claim.jobId,claim.tenantId);return job.status==='running'&&job.fence===claim.fence&&job.leaseOwner===claim.workerId&&job.leaseUntil>ops.now().toISOString()?job:null;}
export function completeIntegration(ops,claim,result,{providers=[]}={}){
 return ops.store.transaction(()=>{
  const job=held(ops,claim);if(!job)return {accepted:false,reason:'LEASE_STALE'};
  if(!policyAllows(ops,job.tenantId)){change(ops,job,{status:'blocked',lastError:'POLICY_BLOCKED',fence:job.fence+1,leaseOwner:null,leaseUntil:null},'integration:blocked');return {accepted:false,reason:'POLICY_BLOCKED'};}
  if(!authorized(ops,job)){change(ops,job,{status:'blocked',lastError:'AUTHORITY_CHANGED',leaseOwner:null,leaseUntil:null,fence:job.fence+1},'integration:blocked');return {accepted:false,reason:'AUTHORITY_CHANGED'};}
  let provider;try{provider=providerFor(providers,job.providerId,job.tenantId)}catch{provider=null;}
  const valid=provider&&job.adapterBinding.provider===provider.adapter.provider&&job.adapterBinding.version===provider.adapter.version&&result&&Object.keys(result).length===2&&result.status==='local_recorded'&&result.externalDelivery===false;
  if(!valid){change(ops,job,{status:'blocked',lastError:'RESULT_INVALID',leaseOwner:null,leaseUntil:null},'integration:blocked');return {accepted:false,reason:'RESULT_INVALID'};}
  const breaker=circuit(ops,job.tenantId,job.providerId);change(ops,breaker,{status:'closed',failures:0,openUntil:null,probeJobId:null,probeUntil:null},'integration:healthy');
  const done=change(ops,job,{status:'completed',completedAt:ops.now().toISOString(),leaseOwner:null,leaseUntil:null,nextAttemptAt:null,lastError:null},'integration:complete');
  return {accepted:true,job:done};
 });
}
function failIntegration(ops,claim,error){
 return ops.store.transaction(()=>{
  const job=held(ops,claim);if(!job)return;
  if(!policyAllows(ops,job.tenantId)){change(ops,job,{status:'blocked',lastError:'POLICY_BLOCKED',fence:job.fence+1,leaseOwner:null,leaseUntil:null},'integration:blocked');return null;}
  if(!authorized(ops,job)){change(ops,job,{status:'blocked',lastError:'AUTHORITY_CHANGED',fence:job.fence+1,leaseOwner:null,leaseUntil:null},'integration:blocked');return;}
  const breaker=circuit(ops,job.tenantId,job.providerId),failures=breaker.failures+1,open=failures>=3||breaker.status==='half_open';
  change(ops,breaker,{failures,status:open?'open':'closed',openUntil:open?new Date(ops.now().getTime()+30000).toISOString():null,probeJobId:null,probeUntil:null},'integration:failure');
  change(ops,job,{status:job.attempts<3?'retry':'dead_letter',lastError:safeCode(error),nextAttemptAt:job.attempts<3?new Date(ops.now().getTime()+1000*2**job.attempts).toISOString():null,leaseOwner:null,leaseUntil:null},'integration:failure');
 });
}
export async function runIntegrationTick(ops,{providers=[],workerId='integration-'+randomUUID(),timeoutMs=2000}={}){
 integer(timeoutMs,1,10000);let completed=0;
 for(const tenant of ops.store.db.prepare('SELECT id FROM tenants').all())for(const candidate of ops.store.list('integrationjob',tenant.id).filter(job=>['pending','retry','running'].includes(job.status)).slice(0,20)){
  const claim=claimIntegration(ops,{tenantId:tenant.id,jobId:candidate.id,workerId,providers});if(!claim)continue;
  let timer;const controller=new AbortController();
  try{
   const job=held(ops,claim),provider=providerFor(providers,job.providerId,tenant.id),envelope=signFixtureEnvelope(provider,{schemaVersion:job.event.schemaVersion,externalId:job.event.externalId,type:job.event.type,occurredAt:job.event.occurredAt,data:job.event.data},{timestamp:ops.now().getTime()});
   const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new OpsError(503,'INTEGRATION_TIMEOUT','Local fixture delivery timed out.')),timeoutMs)});
   const result=await Promise.race([Promise.resolve().then(()=>provider.adapter.deliver(Object.freeze({envelope:Object.freeze(envelope),idempotencyKey:job.id,signal:controller.signal}))),timeout]);
   if(completeIntegration(ops,claim,result,{providers}).accepted)completed++;
  }catch(error){failIntegration(ops,claim,error)}finally{clearTimeout(timer);controller.abort()}
 }
 return completed;
}
export function integrationState(ops,actor,visibleLoads){
 actor=ops.actor(actor.id);
 const scoped=record=>ids.has(record.loadId)&&(record.event.type!=='document'||authorize({actor,action:'document:view',resource:ops.read('load',record.loadId,actor)}));
 const ids=new Set(visibleLoads.filter(load=>authorize({actor,action:'connector:request',resource:ops.read('load',load.id,actor)})&&authorize({actor,action:'load:view',resource:ops.read('load',load.id,actor)})).map(load=>load.id));
 return {integrationReceipts:ops.store.list('integrationreceipt',actor.tenantId).filter(scoped),integrationJobs:ops.store.list('integrationjob',actor.tenantId).filter(scoped),
  integrationCircuits:authorize({actor,action:'governance:manage',resource:{tenantId:actor.tenantId}})?ops.store.list('integrationcircuit',actor.tenantId):[],integrationDisclosure:'Signed local fixture messages only; received reports never modify operational state.'};
}
export const integrationIntegritySQL=`
 CREATE UNIQUE INDEX IF NOT EXISTS unique_integration_receipt ON resources(tenant_id,json_extract(data,'$.providerId'),json_extract(data,'$.eventId')) WHERE kind='integrationreceipt';
 CREATE UNIQUE INDEX IF NOT EXISTS unique_integration_job ON resources(tenant_id,json_extract(data,'$.providerId'),json_extract(data,'$.eventId')) WHERE kind='integrationjob';
 CREATE UNIQUE INDEX IF NOT EXISTS unique_integration_circuit ON resources(tenant_id,json_extract(data,'$.providerId')) WHERE kind='integrationcircuit';
 CREATE TRIGGER IF NOT EXISTS integration_receipt_no_update BEFORE UPDATE ON resources WHEN OLD.kind='integrationreceipt' BEGIN SELECT RAISE(ABORT,'Integration evidence is immutable'); END;
 CREATE TRIGGER IF NOT EXISTS integration_receipt_no_delete BEFORE DELETE ON resources WHEN OLD.kind IN ('integrationreceipt','integrationjob') BEGIN SELECT RAISE(ABORT,'Integration evidence cannot be deleted'); END;
 CREATE TRIGGER IF NOT EXISTS integration_job_evidence_immutable BEFORE UPDATE ON resources WHEN OLD.kind='integrationjob' AND (json_extract(NEW.data,'$.event') IS NOT json_extract(OLD.data,'$.event') OR json_extract(NEW.data,'$.eventHash') IS NOT json_extract(OLD.data,'$.eventHash') OR json_extract(NEW.data,'$.providerId') IS NOT json_extract(OLD.data,'$.providerId') OR json_extract(NEW.data,'$.loadId') IS NOT json_extract(OLD.data,'$.loadId')) BEGIN SELECT RAISE(ABORT,'Integration message evidence is immutable'); END;
`;
