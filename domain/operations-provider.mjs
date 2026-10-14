import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
<<<<<<< HEAD
import {fields,requireValue,integer,OpsError} from './operations-errors.mjs';
import {shippingDocumentReadiness} from './operations-documents.mjs';
const purposes=['dispatch','document','exception','finance'];
const advisoryTools=Object.freeze({dispatch:'dispatch:summary',document:'documents:summary',exception:'exceptions:summary',finance:'finance:readiness'});
=======
import {authorize} from './authorization.mjs';
import {fields,requireValue,integer,OpsError} from './operations-errors.mjs';
import {shippingDocumentReadiness} from './operations-documents.mjs';
const purposes=['dispatch','document','exception','finance'];
>>>>>>> origin/feat/fcc-03-batches-2-11-driver-offline
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value};
export const governedProviderPolicy=freeze({schemaVersion:1,mode:'local-only',modelProviderStatus:'BLOCKED',modelProviderBlocker:'No approved model provider or release evaluation is configured.',toolAllowlist:[],maxContextBytes:16384,maxOutputBytes:2048,requiresHumanApproval:true});
function purposeAccess(ops,actor,load,purpose,permission='intelligence:analyze'){
 requireValue(['carrier','dispatcher'].includes(actor.role),'PROVIDER_AUTHORITY','A human operations principal is required.',403);
 requireValue(purposes.includes(purpose),'PROVIDER_PURPOSE','Choose a supported advisory purpose.');
 ops.guard(actor,permission,load);ops.guard(actor,'load:view',load);
<<<<<<< HEAD
 if(purpose==='dispatch')ops.guard(actor,'asset:view',load);
=======
>>>>>>> origin/feat/fcc-03-batches-2-11-driver-offline
 if(purpose==='document')ops.guard(actor,'document:view',load);
 if(purpose==='finance'){ops.guard(actor,'billing:manage',load);ops.guard(actor,'document:view',load);}
}
export function buildGovernedContext(ops,actor,load,purpose){
 actor=ops.actor(actor.id);load=ops.read('load',load.id,actor);purposeAccess(ops,actor,load,purpose);
<<<<<<< HEAD
 const policy=ops.store.list('governancepolicy',actor.tenantId)[0];
 requireValue(!policy||(policy.enabled===true&&Array.isArray(policy.disabledTools)&&!policy.disabledTools.includes(advisoryTools[purpose])),'POLICY_BLOCKED','The carrier policy blocks this advisory purpose.',409);
=======
>>>>>>> origin/feat/fcc-03-batches-2-11-driver-offline
 let facts;
 if(purpose==='dispatch'){
  const drivers=ops.store.list('driver',actor.tenantId).filter(item=>item.active),vehicles=ops.store.list('vehicle',actor.tenantId).filter(item=>item.active);
  requireValue(drivers.length<=100&&vehicles.length<=100,'PROVIDER_BOUND','Use the dispatch workflow to narrow large capacity pools.');
  let eligiblePairCount=0;for(const driver of drivers)for(const vehicle of vehicles)if(ops.eligibility(actor,driver.id,vehicle.id,load,load.id).eligible)eligiblePairCount++;
  facts={eligiblePairCount,dispatchable:['validated','assigned','accepted'].includes(load.status)};
 }else if(purpose==='document'||purpose==='finance'){
  const readiness=shippingDocumentReadiness(ops,actor,load);
  facts={documentsReady:readiness.ready,issueCodes:readiness.issues,delivered:load.status==='delivered'};
 }else{
  const openCount=ops.store.list('exception',actor.tenantId).filter(item=>item.loadId===load.id&&item.status==='open').length;
  const overdueCount=load.stops.filter(stop=>!stop.completedAt&&stop.at<ops.now().toISOString()).length;
  facts={openCount,overdueCount};
 }
 const context={schemaVersion:1,purpose,shipment:{id:load.id,version:load.version,status:load.status},facts};
 requireValue(Buffer.byteLength(JSON.stringify(context))<=governedProviderPolicy.maxContextBytes,'PROVIDER_BOUND','Advisory context exceeds the supported bound.');
 return freeze(context);
}
function expected(context){
 let label;
 if(context.purpose==='dispatch')label=context.facts.dispatchable&&context.facts.eligiblePairCount>0?'requires_human_approval':'no_eligible_capacity';
 else if(context.purpose==='document')label=context.facts.documentsReady?'documents_validated':'human_document_review_required';
 else if(context.purpose==='finance')label=context.facts.documentsReady&&context.facts.delivered?'finance_review_required':'finance_blocked';
 else label=context.facts.openCount||context.facts.overdueCount?'human_exception_review_required':'no_observed_exception';
 return {label,requiresHumanApproval:true,toolCalls:[]};
}
export const localGovernedAdapter=Object.freeze({provider:'local-governed-rules',version:'1',mode:'local-only',model:null,recommend:context=>expected(context)});
function binding(adapter){
 requireValue(adapter?.mode==='local-only'&&adapter.model===null&&typeof adapter.recommend==='function'&&/^[a-z0-9-]{1,40}$/.test(adapter.provider??'')&&/^[A-Za-z0-9.-]{1,30}$/.test(adapter.version??''),'MODEL_PROVIDER_BLOCKED','Only a configured local advisory adapter is enabled.',503);
 return {provider:adapter.provider,providerVersion:adapter.version,model:null,mode:'local-only',live:false,policyVersion:1};
}
function validateContext(context){
 fields(context,['schemaVersion','purpose','shipment','facts']);fields(context.shipment,['id','version','status']);
 requireValue(context.schemaVersion===1&&purposes.includes(context.purpose)&&typeof context.shipment.id==='string'&&context.shipment.id.length<=100&&Number.isSafeInteger(context.shipment.version)&&context.shipment.version>0&&['draft','validated','assigned','accepted','in_transit','delivered','void','picked_up'].includes(context.shipment.status),'PROVIDER_CONTEXT','Use a server-scoped advisory context.');
 const facts=context.facts;
 if(context.purpose==='dispatch'){fields(facts,['eligiblePairCount','dispatchable']);integer(facts.eligiblePairCount,0,10000);requireValue(typeof facts.dispatchable==='boolean','PROVIDER_CONTEXT','Invalid dispatch evidence.');}
 else if(context.purpose==='document'||context.purpose==='finance'){
  fields(facts,['documentsReady','issueCodes','delivered']);requireValue(typeof facts.documentsReady==='boolean'&&typeof facts.delivered==='boolean'&&Array.isArray(facts.issueCodes)&&facts.issueCodes.length<=20&&facts.issueCodes.every(code=>typeof code==='string'&&/^[A-Z_]{1,60}$/.test(code)),'PROVIDER_CONTEXT','Invalid document readiness evidence.');
 }else{fields(facts,['openCount','overdueCount']);integer(facts.openCount,0,100000);integer(facts.overdueCount,0,1000);}
 requireValue(Buffer.byteLength(JSON.stringify(context))<=16384,'PROVIDER_BOUND','Advisory context exceeds the supported bound.');
 return freeze(structuredClone(context));
}
function validate(result,request){
 let serialized;try{serialized=JSON.stringify(result)}catch{}
 requireValue(typeof serialized==='string'&&Buffer.byteLength(serialized)<=2048,'PROVIDER_OUTPUT','Advisory response exceeds the supported schema.',503);
 fields(result,['label','requiresHumanApproval','toolCalls']);
 requireValue(result.label===expected(request).label&&result.requiresHumanApproval===true&&Array.isArray(result.toolCalls)&&result.toolCalls.length===0,'PROVIDER_OUTPUT','Advisory response violated evidence or tool policy.',503);
 return expected(request);
}
const failureCode=error=>error?.code==='PROVIDER_TIMEOUT'?'PROVIDER_TIMEOUT':error?.code==='PROVIDER_OUTPUT'||error?.code==='FIELDS'?'PROVIDER_OUTPUT':'PROVIDER_FAILURE';
<<<<<<< HEAD
function finish(context,result,provenance,start,{fallback=false,failure=null,attempted=null,evaluationHook}={}){
 const output={...result,...provenance,contextHash:hash(context),latencyMs:Math.max(0,performance.now()-start),fallback,failureCode:failure,attemptedProvider:attempted?.provider??null,attemptedProviderVersion:attempted?.providerVersion??null,modelProviderStatus:'BLOCKED',modelInferenceCount:0,inferenceCostUSD:null};
 if(typeof evaluationHook==='function'){try{const observed=evaluationHook(freeze({schemaVersion:1,purpose:context.purpose,label:output.label,contextHash:output.contextHash,provider:output.provider,providerVersion:output.providerVersion,model:null,latencyMs:output.latencyMs,fallback,policyPassed:true}));if(observed&&typeof observed.then==='function')Promise.resolve(observed).catch(()=>{});}catch{}}
=======
function finish(context,result,provenance,start,{fallback=false,failure=null,evaluationHook}={}){
 const output={...result,...provenance,contextHash:hash(context),latencyMs:Math.max(0,performance.now()-start),fallback,failureCode:failure,modelProviderStatus:'BLOCKED',modelInferenceCount:0,inferenceCostUSD:null};
 if(typeof evaluationHook==='function'){try{evaluationHook(freeze({schemaVersion:1,purpose:context.purpose,label:output.label,contextHash:output.contextHash,provider:output.provider,providerVersion:output.providerVersion,model:null,latencyMs:output.latencyMs,fallback,policyPassed:true}))}catch{}}
>>>>>>> origin/feat/fcc-03-batches-2-11-driver-offline
 return output;
}
export function recommendWithProvider(context,{adapter=localGovernedAdapter,evaluationHook}={}){
 const provenance=binding(adapter),request=validateContext(context),start=performance.now();
 try{const result=adapter.recommend(request);if(result&&typeof result.then==='function'){Promise.resolve(result).catch(()=>{});throw new OpsError(503,'PROVIDER_FAILURE','Asynchronous provider requires a worker.');}return finish(request,validate(result,request),provenance,start,{evaluationHook});}
<<<<<<< HEAD
 catch(error){return finish(request,expected(request),binding(localGovernedAdapter),start,{fallback:true,failure:failureCode(error),attempted:provenance,evaluationHook});}
=======
 catch(error){return finish(request,expected(request),binding(localGovernedAdapter),start,{fallback:true,failure:failureCode(error),evaluationHook});}
>>>>>>> origin/feat/fcc-03-batches-2-11-driver-offline
}
export async function invokeGovernedProvider(context,{adapter=localGovernedAdapter,timeoutMs=2000,evaluationHook}={}){
 const provenance=binding(adapter),request=validateContext(context),start=performance.now();integer(timeoutMs,1,10000);let timer;
 try{
  const result=await Promise.race([Promise.resolve().then(()=>adapter.recommend(request)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new OpsError(503,'PROVIDER_TIMEOUT','Local advisory execution timed out.')),timeoutMs)})]);
  return finish(request,validate(result,request),provenance,start,{evaluationHook});
<<<<<<< HEAD
 }catch(error){return finish(request,expected(request),binding(localGovernedAdapter),start,{fallback:true,failure:failureCode(error),attempted:provenance,evaluationHook});}finally{clearTimeout(timer)}
=======
 }catch(error){return finish(request,expected(request),binding(localGovernedAdapter),start,{fallback:true,failure:failureCode(error),evaluationHook});}finally{clearTimeout(timer)}
>>>>>>> origin/feat/fcc-03-batches-2-11-driver-offline
}
export function createProviderExtensions(options={}){return {
 'provider:recommend':(ops,actor,c)=>{
  fields(c.payload??{},['purpose']);const load=ops.read('load',c.resourceId,actor);ops.version(load,c.expectedVersion);
  const context=buildGovernedContext(ops,actor,load,c.payload.purpose),result=recommendWithProvider(context,options);
<<<<<<< HEAD
  const record=ops.store.insert('providerrecommendation',actor.tenantId,{loadId:load.id,loadVersion:load.version,purpose:context.purpose,...result,governancePolicyVersion:ops.store.list('governancepolicy',actor.tenantId)[0]?.version??0,requestedBy:actor.id,createdAt:ops.now().toISOString(),status:'advisory'});
=======
  const record=ops.store.insert('providerrecommendation',actor.tenantId,{loadId:load.id,loadVersion:load.version,purpose:context.purpose,...result,requestedBy:actor.id,createdAt:ops.now().toISOString(),status:'advisory'});
>>>>>>> origin/feat/fcc-03-batches-2-11-driver-offline
  ops.store.audit(actor,c.action,record.id,'success',{loadId:load.id,purpose:record.purpose,label:record.label,provider:record.provider,model:null,contextHash:record.contextHash,fallback:record.fallback},ops.now().toISOString());return record;
 }
};}
export function providerState(ops,actor,visibleLoads){
 actor=ops.actor(actor.id);const ids=new Set(visibleLoads.map(load=>load.id));
 const recommendations=ops.store.list('providerrecommendation',actor.tenantId).filter(record=>{
  if(!ids.has(record.loadId))return false;
  try{purposeAccess(ops,actor,ops.read('load',record.loadId,actor),record.purpose,'intelligence:view');return true}catch{return false}
 });
 return {providerRecommendations:recommendations,providerPolicy:governedProviderPolicy};
}
export const providerIntegritySQL=`
CREATE TRIGGER IF NOT EXISTS provider_recommendation_no_update BEFORE UPDATE ON resources WHEN OLD.kind='providerrecommendation' BEGIN SELECT RAISE(ABORT,'Provider advisory evidence is immutable'); END;
CREATE TRIGGER IF NOT EXISTS provider_recommendation_no_delete BEFORE DELETE ON resources WHEN OLD.kind='providerrecommendation' BEGIN SELECT RAISE(ABORT,'Provider advisory evidence cannot be deleted'); END;
`;
