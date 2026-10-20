import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/operations-fixture.mjs';
import {createRuntimeExtensions} from '../domain/operations-runtime.mjs';
import {OperationsStore} from '../server/operations-store.mjs';
import {createProviderExtensions,providerState,providerIntegritySQL,buildGovernedContext,localGovernedAdapter,recommendWithProvider,invokeGovernedProvider,governedProviderPolicy} from '../domain/operations-provider.mjs';
const code=value=>error=>error.code===value;
function install(f,options={}){Object.assign(f.ops.extensions,createProviderExtensions(options));f.ops.views.push(providerState);f.store.db.exec(providerIntegritySQL);return f;}
const validated=f=>{const load=f.createLoad();return f.command(f.dispatcher,'load:validate',load)};
function revoke(f,actor,permission){const user=f.store.principal(actor.id);f.store.db.prepare('UPDATE users SET data=? WHERE id=?').run(JSON.stringify({...user,permissions:user.permissions.filter(value=>value!==permission)}),actor.id);}
test('B56 server-scoped local adapter produces immutable advice with honest blocked model status and no authority gain',async t=>{
 const observed=[],f=install(await fixture(t),{evaluationHook:record=>observed.push(record)}),load=validated(f);
 const record=f.command(f.dispatcher,'provider:recommend',load,{purpose:'dispatch'},'provider-once');
 assert.equal(record.label,'requires_human_approval');assert.equal(record.requiresHumanApproval,true);assert.deepEqual(record.toolCalls,[]);
 assert.equal(record.model,null);assert.equal(record.modelProviderStatus,'BLOCKED');assert.equal(record.inferenceCostUSD,null);assert.equal(record.modelInferenceCount,0);
 assert.equal(record.fallback,false);assert.equal(record.provider,'local-governed-rules');assert.equal(observed.length,1);assert.equal(observed[0].policyPassed,true);
 assert.deepEqual(f.command(f.dispatcher,'provider:recommend',load,{purpose:'dispatch'},'provider-once'),record);assert.equal(observed.length,1);
 assert.equal(f.store.list('assignment',load.tenantId).length,0);assert.deepEqual(f.store.get('load',load.id,load.tenantId),load);
 assert.throws(()=>f.store.update(record.kind,record.id,load.tenantId,record.version,{label:'execute_assignment'}),/immutable/);
 const reopened=new OperationsStore(f.path);assert.equal(reopened.get(record.kind,record.id,load.tenantId).contextHash,record.contextHash);reopened.close();
});
test('B56 context minimization omits names, document bodies, commercial amounts and full operational resources',async t=>{
 const contexts=[],f=install(await fixture(t),{adapter:{...localGovernedAdapter,recommend:request=>{contexts.push(request);return localGovernedAdapter.recommend(request)}}}),load=validated(f);
 for(const purpose of ['dispatch','document','exception'])f.command(f.dispatcher,'provider:recommend',load,{purpose});
 f.command(f.manager,'provider:recommend',load,{purpose:'finance'});
 assert.equal(contexts.length,4);
 const serialized=JSON.stringify(contexts);for(const forbidden of [load.reference,load.customer,load.commodity,'250000','rateCents','content','tenantId','password','permissions'])assert.ok(!serialized.includes(forbidden),forbidden);
 assert.ok(contexts.every(Object.isFrozen));assert.ok(contexts.every(context=>Object.isFrozen(context.facts)));
 assert.throws(()=>f.command(f.dispatcher,'provider:recommend',load,{purpose:'finance'}),code('FORBIDDEN'));
 assert.throws(()=>f.command(f.driver,'provider:recommend',load,{purpose:'dispatch'}),code('PROVIDER_AUTHORITY'));
 assert.throws(()=>f.command(f.otherDispatcher,'provider:recommend',load,{purpose:'dispatch'}),code('FORBIDDEN'));
 assert.throws(()=>f.command(f.outsider,'provider:recommend',load,{purpose:'dispatch'}),code('NOT_FOUND'));
});
test('B56 fabricated advice, oversized output and tool calls fall back deterministically with sanitized provenance',async t=>{
 const f=install(await fixture(t)),load=validated(f),context=buildGovernedContext(f.ops,f.dispatcher,load,'dispatch');
 const outputs=[{label:'execute_assignment',requiresHumanApproval:false,toolCalls:['load:assign']},{label:'requires_human_approval',requiresHumanApproval:true,toolCalls:[],provider:'approved-model'},{label:'x'.repeat(5000),requiresHumanApproval:true,toolCalls:[]}];
 for(const output of outputs){const result=recommendWithProvider(context,{adapter:{...localGovernedAdapter,provider:'illustrative-invalid',recommend:()=>output}});assert.equal(result.fallback,true);assert.equal(result.failureCode,'PROVIDER_OUTPUT');assert.equal(result.provider,'local-governed-rules');assert.equal(result.label,'requires_human_approval');assert.deepEqual(result.toolCalls,[]);}
 const failed=recommendWithProvider(context,{adapter:{...localGovernedAdapter,recommend:()=>{throw new Error('private-provider-detail')}}});
 assert.equal(failed.failureCode,'PROVIDER_FAILURE');assert.ok(!JSON.stringify(failed).includes('private-provider-detail'));
});
test('B56 async timeout and failure use bounded local fallback, while unapproved live/model configuration is blocked',async t=>{
 const f=await fixture(t),load=validated(f),context=buildGovernedContext(f.ops,f.dispatcher,load,'dispatch');
 const result=await invokeGovernedProvider(context,{adapter:{...localGovernedAdapter,recommend:()=>new Promise(()=>{})},timeoutMs:5});
 assert.equal(result.fallback,true);assert.equal(result.failureCode,'PROVIDER_TIMEOUT');assert.equal(result.model,null);
 let called=false;for(const adapter of [{...localGovernedAdapter,mode:'live',recommend:()=>{called=true}},{...localGovernedAdapter,model:'unapproved-model',recommend:()=>{called=true}}])assert.throws(()=>recommendWithProvider(context,{adapter}),code('MODEL_PROVIDER_BLOCKED'));
 assert.equal(called,false);assert.deepEqual(governedProviderPolicy.toolAllowlist,[]);
 assert.throws(()=>recommendWithProvider({...context,secret:'not permitted'}),code('FIELDS'));
});
test('B56 current grants govern existing advice, document/finance replay and stale persisted actor objects',async t=>{
 const f=install(await fixture(t)),load=validated(f);
 const doc=f.command(f.dispatcher,'provider:recommend',load,{purpose:'document'},'doc-recommendation');
 const finance=f.command(f.manager,'provider:recommend',load,{purpose:'finance'},'finance-recommendation');
 revoke(f,f.dispatcher,'document:view');assert.equal(providerState(f.ops,f.dispatcher,[load]).providerRecommendations.some(record=>record.id===doc.id),false);
 assert.throws(()=>f.command(f.dispatcher,'provider:recommend',load,{purpose:'document'},'doc-recommendation'),code('FORBIDDEN'));
 revoke(f,f.manager,'billing:manage');assert.equal(providerState(f.ops,f.manager,[load]).providerRecommendations.some(record=>record.id===finance.id),false);
 assert.throws(()=>f.command(f.manager,'provider:recommend',load,{purpose:'finance'},'finance-recommendation'),code('FORBIDDEN'));
 revoke(f,f.dispatcher,'intelligence:analyze');assert.throws(()=>buildGovernedContext(f.ops,f.dispatcher,load,'dispatch'),code('FORBIDDEN'));
});
test('B56 actual deterministic fixture evaluation reports measured local labels, no inference cost or model pass',async t=>{
 const evaluated=[],f=install(await fixture(t),{evaluationHook:record=>evaluated.push(record)}),load=validated(f);
 const cases=[['dispatch','requires_human_approval',f.dispatcher],['document','human_document_review_required',f.dispatcher],['exception','no_observed_exception',f.dispatcher],['finance','finance_blocked',f.manager]];
 let passed=0;for(const [purpose,label,actor] of cases){const record=f.command(actor,'provider:recommend',load,{purpose});if(record.label===label&&record.requiresHumanApproval&&record.toolCalls.length===0)passed++;}
 assert.equal(passed,cases.length);assert.equal(evaluated.length,cases.length);
 assert.ok(evaluated.every(record=>record.latencyMs>=0&&Number.isFinite(record.latencyMs)&&record.model===null&&record.policyPassed));
 const driver=f.store.get('driver',f.driver.id,load.tenantId);f.command(f.manager,'driver:update',driver,{compliance:'critical',reason:'Illustrative eligibility change'});
 assert.equal(f.command(f.dispatcher,'provider:recommend',load,{purpose:'dispatch'}).label,'no_eligible_capacity');
});

test('B66/B76 provider obeys current carrier governance switches and records reviewed policy version',async t=>{
 const f=install(await fixture(t)),load=validated(f);Object.assign(f.ops.extensions,createRuntimeExtensions());
 let policy=f.command(f.manager,'governance:update',null,{enabled:false,disabledTools:[],reason:'Illustrative carrier pause'});
 assert.throws(()=>f.command(f.dispatcher,'provider:recommend',load,{purpose:'dispatch'}),code('POLICY_BLOCKED'));
 policy=f.command(f.manager,'governance:update',policy,{enabled:true,disabledTools:['dispatch:summary'],reason:'Keep dispatch advisory disabled'});
 assert.throws(()=>f.command(f.dispatcher,'provider:recommend',load,{purpose:'dispatch'}),code('POLICY_BLOCKED'));
 const allowed=f.command(f.dispatcher,'provider:recommend',load,{purpose:'exception'});
 assert.equal(allowed.governancePolicyVersion,policy.version);assert.equal(allowed.modelProviderStatus,'BLOCKED');
 policy=f.command(f.manager,'governance:update',policy,{enabled:true,disabledTools:[],reason:'Allow local advisory again'});
 const dispatch=f.command(f.dispatcher,'provider:recommend',load,{purpose:'dispatch'},'dispatch-grant-replay');
 assert.equal(dispatch.governancePolicyVersion,policy.version);
 revoke(f,f.dispatcher,'asset:view');
 assert.throws(()=>f.command(f.dispatcher,'provider:recommend',load,{purpose:'dispatch'},'dispatch-grant-replay'),code('FORBIDDEN'));
 assert.equal(providerState(f.ops,f.dispatcher,[load]).providerRecommendations.some(record=>record.id===dispatch.id),false);
});
test('B66/B76 fallback records attempted binding and isolates evaluation hook failures',async t=>{
 const f=await fixture(t),load=validated(f),context=buildGovernedContext(f.ops,f.dispatcher,load,'dispatch');
 const result=recommendWithProvider(context,{adapter:{...localGovernedAdapter,provider:'illustrative-provider',version:'2',recommend:()=>{throw new Error('private failure')}},evaluationHook:async()=>{throw new Error('private observer failure')}});
 assert.equal(result.provider,'local-governed-rules');assert.equal(result.attemptedProvider,'illustrative-provider');assert.equal(result.attemptedProviderVersion,'2');
 assert.equal(result.failureCode,'PROVIDER_FAILURE');assert.ok(!JSON.stringify(result).includes('private'));
 await new Promise(resolve=>setImmediate(resolve));
});
