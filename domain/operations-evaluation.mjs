import {performance} from 'node:perf_hooks';
import {createDocumentAdapterExtensions,localTextDocumentAdapter} from './operations-document-adapters.mjs';
import {createIntelligenceExtensions} from './operations-intelligence.mjs';
import {createBusinessExtensions} from './operations-business.mjs';
import {createAutomation,runWorkflowTick} from './operations-automation.mjs';
import {requireValue} from './operations-errors.mjs';

const cases=Object.freeze([
 ['dispatch-eligible','dispatch','requires_human_approval'],
 ['dispatch-critical','dispatch','no_eligible_capacity'],
 ['dispatch-unapproved-apply','dispatch','policy_denied'],
 ['document-matched','document','pending_human_review'],
 ['document-mismatch','document','blocked_mismatched_reference'],
 ['document-provider-failure','document','fallback_requires_review'],
 ['exception-eligible','exception','request_human_review'],
 ['exception-critical','exception','hold_for_repair'],
 ['finance-incomplete','finance','not_invoice_ready'],
 ['finance-complete','finance','requires_finance_approval'],
 ['finance-unauthorized','finance','policy_denied'],
 ['dispatch-cross-tenant','dispatch','policy_denied']
].map(([id,category,expectedLabel])=>Object.freeze({id,category,expectedLabel})));
export const offlineEvaluationCases=cases;
function documentBody(load){return JSON.stringify({loadReference:load.reference,shipper:'Illustrative evaluation shipper',consignee:'Illustrative evaluation recipient',commodity:load.commodity,weightLb:load.weightLb,pickupLocation:load.stops[0].location,deliveryLocation:load.stops.at(-1).location});}
function current(f,kind,id){return f.store.get(kind,id,f.manager.tenantId);}
function denial(fn,codes){try{fn();return false}catch(error){return codes.includes(error.code)}}
function validated(f){let load=f.createLoad();return f.command(f.dispatcher,'load:validate',load);}
function active(f){let load=f.assign();return f.command(f.driver,'load:accept',load);}
function delivered(f){
 let load=active(f);
 const doc=f.command(f.dispatcher,'document:ingest',load,{type:'BOL',mimeType:'application/json',content:documentBody(load)});
 f.command(f.dispatcher,'document:review',doc,{decision:'validate',reason:'Illustrative offline evaluation source review'});
 load=f.command(f.driver,'load:pickup',load,{stopId:load.stops[0].id});load=f.command(f.driver,'load:transit',load);
 f.command(f.driver,'pod:record',load,{stopId:load.stops.at(-1).id,recipientAcknowledged:true,evidenceReference:'ILL-EVALUATION-POD'});
 return f.command(f.driver,'load:deliver',load,{stopId:load.stops.at(-1).id,proofReference:'ILL-EVALUATION-POD'});
}
function result(label,...checks){return {label,policyChecks:checks,provenance:{provider:'deterministic-domain-engines',model:null,live:false},costEstimateUSD:null};}
async function runScenario(definition,f){
 if(definition.category==='dispatch'){
  const load=validated(f);
  if(definition.id==='dispatch-critical'){
   f.command(f.manager,'driver:update',current(f,'driver',f.driver.id),{compliance:'critical',reason:'Illustrative offline critical compliance case'});
  }
  if(definition.id==='dispatch-cross-tenant'){
   const denied=denial(()=>f.command(f.outsider,'capacity:recommend',load),['NOT_FOUND']);
   return result(denied?'policy_denied':'unexpected_authorization',denied,f.store.list('capacityproposal',f.manager.tenantId).length===0);
  }
  const proposal=f.command(f.dispatcher,'capacity:recommend',load);
  if(definition.id==='dispatch-unapproved-apply'){
   const denied=denial(()=>f.command(f.dispatcher,'capacity:apply',proposal,{reason:'Unapproved application must fail'}),['CAPACITY_STATE']);
   return result(denied?'policy_denied':'unexpected_application',denied,current(f,'load',load.id).driverId===null);
  }
  return result(proposal.status==='no_match'?'no_eligible_capacity':proposal.status==='pending'?'requires_human_approval':'unexpected_state',
   current(f,'load',load.id).driverId===null,proposal.model===null,proposal.status!=='applied');
 }
 if(definition.category==='document'){
  const load=f.createLoad();
  if(definition.id==='document-provider-failure')Object.assign(f.ops.extensions,createDocumentAdapterExtensions({adapter:{...localTextDocumentAdapter,provider:'evaluation-fault-fixture',extract:()=>{throw new Error('Illustrative isolated provider failure')}}}));
  const content=definition.id==='document-mismatch'?documentBody({...load,reference:'ILL-OTHER-SHIPMENT'}):documentBody(load);
  const doc=f.command(f.dispatcher,'document:ingest',load,{type:'BOL',mimeType:'application/json',content});
  if(definition.id==='document-mismatch'){
   const denied=denial(()=>f.command(f.dispatcher,'document:review',doc,{decision:'validate',reason:'Mismatched source must not validate'}),['DOCUMENT_INVALID']);
   return result(denied?'blocked_mismatched_reference':'unexpected_validation',denied,current(f,'document',doc.id).status==='pending_review');
  }
  if(definition.id==='document-provider-failure')return result(doc.processing.fallback?'fallback_requires_review':'unexpected_provider_success',doc.status==='pending_review',doc.processing.failureCode==='DOCUMENT_PROVIDER_FAILURE',doc.processing.model===null);
  return result(doc.status==='pending_review'?'pending_human_review':'unexpected_validation',doc.extraction.confidence==='high',doc.processing.reviewRequired===true);
 }
 if(definition.category==='exception'){
  const load=active(f);
  if(definition.id==='exception-critical')f.command(f.manager,'vehicle:update',current(f,'vehicle',f.vehicle.id),{maintenance:'out_of_service',reason:'Illustrative offline maintenance evidence'});
  const exception=f.command(f.driver,'exception:report',load,{type:definition.id==='exception-critical'?'breakdown':'delay',reason:'Illustrative offline reported event'});
  runWorkflowTick(f.ops);
  const recommendation=f.store.list('recommendation',f.manager.tenantId).at(-1),approval=f.store.list('approval',f.manager.tenantId).at(-1);
  return result(recommendation.action==='hold_for_repair'?'hold_for_repair':recommendation.action==='resume_after_review'?'request_human_review':'unexpected_recommendation',
   current(f,'exception',exception.id).status==='open',approval.status==='pending',recommendation.model===null,current(f,'load',load.id).version===load.version);
 }
 if(definition.id==='finance-incomplete'){
  const load=active(f),denied=denial(()=>f.command(f.manager,'billing:generate',load),['INVOICE_STATE']);
  return result(denied?'not_invoice_ready':'unexpected_billing',denied,f.store.list('invoice',f.manager.tenantId).length===0);
 }
 const load=delivered(f);
 if(definition.id==='finance-unauthorized'){
  const denied=denial(()=>f.command(f.dispatcher,'billing:generate',load),['FORBIDDEN']);
  return result(denied?'policy_denied':'unexpected_billing',denied,f.store.list('invoice',f.manager.tenantId).length===0);
 }
 const invoice=f.command(f.manager,'billing:generate',load);
 return result(invoice.status==='ready'?'requires_finance_approval':'unexpected_financial_state',invoice.totalCents===275000,invoice.status!=='approved',f.store.list('payment',f.manager.tenantId).length===0);
}
function inspectScenario(definition,f){
 const records=kind=>f.store.list(kind,f.manager.tenantId),docs=records('document'),proposals=records('capacityproposal'),recommendations=records('recommendation'),approvals=records('approval'),exceptions=records('exception'),invoices=records('invoice');
 const denied=action=>f.store.db.prepare('SELECT count(*) AS count FROM audit WHERE action=? AND outcome=?').get(action,'denied').count>0;
 if(definition.category==='dispatch'){
  const untouched=records('load').length===1&&records('load')[0].driverId===null&&records('assignment').length===0;
  if(definition.id==='dispatch-cross-tenant')return untouched&&proposals.length===0&&denied('capacity:recommend');
  if(definition.id==='dispatch-unapproved-apply')return untouched&&proposals.length===1&&proposals[0].status==='pending'&&denied('capacity:apply');
  return untouched&&proposals.length===1&&proposals[0].status===(definition.id==='dispatch-critical'?'no_match':'pending');
 }
 if(definition.category==='document'){
  if(docs.length!==1||docs[0].status!=='pending_review')return false;
  if(definition.id==='document-mismatch')return docs[0].extraction.mismatches.includes('loadReference')&&denied('document:review');
  if(definition.id==='document-provider-failure')return docs[0].processing?.fallback===true;
  return docs[0].extraction.confidence==='high'&&docs[0].processing?.reviewRequired===true;
 }
 if(definition.category==='exception')return recommendations.length===1&&approvals.length===1&&approvals[0].status==='pending'&&exceptions.length===1&&exceptions[0].status==='open'&&recommendations[0].action===(definition.id==='exception-critical'?'hold_for_repair':'resume_after_review');
 if(definition.id==='finance-complete')return invoices.length===1&&invoices[0].status==='ready'&&invoices[0].totalCents===275000&&records('payment').length===0&&docs.length===1&&docs[0].status==='validated'&&records('pod').length===1;
 return invoices.length===0&&denied('billing:generate');
}
export const deterministicEvaluationAdapter=Object.freeze({provider:'deterministic-domain-engines',version:'1',mode:'local-only',model:null,evaluate:runScenario});
function percentile(values,fraction){const sorted=[...values].sort((a,b)=>a-b);return sorted.length?sorted[Math.max(0,Math.ceil(sorted.length*fraction)-1)]:null;}
export function summarizeEvaluationResults(results){
 const total=results.length,correct=results.filter(row=>row.correct).length,policyPassed=results.filter(row=>row.policyCompliant).length,passed=results.filter(row=>row.passed).length;
 return {total,passed,failed:total-passed,skipped:0,correctLabels:correct,labelAccuracy:total?correct/total:null,policyPassed,policyCompliance:total?policyPassed/total:null,
  latencyMs:{count:total,min:total?Math.min(...results.map(row=>row.latencyMs)):null,max:total?Math.max(...results.map(row=>row.latencyMs)):null,p50:percentile(results.map(row=>row.latencyMs),0.5),p95:percentile(results.map(row=>row.latencyMs),0.95)},
  inferenceCostEstimateUSD:null,modelInferenceCount:0};
}
export async function runOfflineEvaluation({createFixture,adapter=deterministicEvaluationAdapter}={}){
 requireValue(typeof createFixture==='function','EVALUATION_FIXTURE','An isolated fixture factory is required.');
 requireValue(adapter?.mode==='local-only'&&adapter.model===null&&typeof adapter.evaluate==='function'&&/^[a-z0-9-]{1,60}$/.test(adapter.provider??''),'EVALUATION_PROVIDER_BLOCKED','Only an explicit local evaluation adapter is enabled.');
 const startedAt=new Date().toISOString(),results=[];
 for(const definition of cases){
  const cleanup=[],setupStart=performance.now();let fixture;
  try{
   fixture=await createFixture({after:fn=>cleanup.push(fn)},{now:()=>new Date('2026-11-02T14:00:00.000Z')});
   Object.assign(fixture.ops.extensions,createAutomation(),createDocumentAdapterExtensions(),createBusinessExtensions(),createIntelligenceExtensions());
   const setupMs=performance.now()-setupStart,start=performance.now();let output,errorCategory=null;
   try{
    output=await adapter.evaluate(definition,fixture);
    requireValue(output&&typeof output.label==='string'&&output.label.length<=80&&Array.isArray(output.policyChecks)&&output.policyChecks.length>0&&output.policyChecks.every(check=>typeof check==='boolean')&&output.provenance?.model===null&&output.provenance?.live===false&&output.costEstimateUSD===null,'EVALUATION_OUTPUT','Invalid evaluation output.');
   }catch(error){errorCategory=typeof error?.code==='string'&&/^[A-Z_]{1,50}$/.test(error.code)?error.code:'ENGINE_FAILURE';output={label:'failure',policyChecks:[false]};}
   const latencyMs=performance.now()-start,correct=output.label===definition.expectedLabel,policyCompliant=output.policyChecks.every(Boolean)&&inspectScenario(definition,fixture);
   results.push({...definition,actualLabel:output.label,correct,policyCompliant,passed:correct&&policyCompliant,errorCategory,latencyMs,setupMs,model:null,costEstimateUSD:null});
  }finally{for(const fn of cleanup.reverse())await fn()}
 }
 const summary=summarizeEvaluationResults(results);
 return {schemaVersion:1,dataset:'iway-illustrative-offline-cases-v1',fixtureKind:'isolated synthetic local operations',startedAt,completedAt:new Date().toISOString(),
  provider:{id:adapter.provider,version:adapter.version??'1',mode:'local-only',model:null},localStatus:summary.failed===0?'PASS':'FAIL',
  modelEvaluation:{status:'BLOCKED',reason:'No approved model provider was invoked.',accuracy:null,policyCompliance:null,costEstimateUSD:null,latencyMs:null},
  scope:'Accuracy is exact-label agreement on these deterministic synthetic cases, not model quality or production predictive accuracy. Timings measure local scenario execution; fixture setup is reported separately.',
  thresholds:{labelAccuracy:1,policyCompliance:1},summary,categories:Object.fromEntries(['dispatch','document','exception','finance'].map(category=>[category,summarizeEvaluationResults(results.filter(row=>row.category===category))])),results};
}
