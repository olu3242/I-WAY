import test from 'node:test';
import assert from 'node:assert/strict';
import {executeAsyncOperationsCommand as execute} from '../domain/operations-async-command.mjs';
const scope={tenantId:'11111111-1111-4111-8111-111111111111',actorId:'22222222-2222-4222-8222-222222222222'};
const command={action:'load:create',idempotencyKey:'33333333-3333-4333-8333-333333333333',payload:{name:'Sample'}};
function fixture(){
 const records=new Map();let audits=0,commits=0;
 const principal={id:scope.actorId,tenantId:scope.tenantId,active:true};
 const store={async transaction(s,work){
  assert.deepEqual(s,scope);
  const staged=new Map(records);let pendingAudits=0;
  const tx={principal:async()=>principal,command:async key=>staged.get(key),recordCommand:async(key,digest,result)=>{staged.set(key,{digest,result})},audit:async()=>{pendingAudits++}};
  const result=await work(tx);
  records.clear();for(const [k,v] of staged)records.set(k,v);
  audits+=pendingAudits;commits++;return result;
 }};
 return {store,principal,counts:()=>({audits,commits})};
}
const auth=async()=>true;
test('async command commits once and returns identical replay result',async()=>{
 const f=fixture();let calls=0;
 const perform=async()=>{calls++;return {id:'created'}};
 assert.deepEqual(await execute({store:f.store,scope,command,authorize:auth,perform}),{id:'created'});
 assert.deepEqual(await execute({store:f.store,scope,command,authorize:auth,perform}),{id:'created'});
 assert.equal(calls,1);assert.equal(f.counts().audits,1);
});
test('changed input with reused key is rejected',async()=>{
 const f=fixture();const perform=async()=>({id:'created'});
 await execute({store:f.store,scope,command,authorize:auth,perform});
 await assert.rejects(execute({store:f.store,scope,command:{...command,payload:{name:'Changed'}},authorize:auth,perform}),{code:'IDEMPOTENCY_CONFLICT'});
});
test('revoked principal cannot replay completed command',async()=>{
 const f=fixture();const perform=async()=>({id:'created'});
 await execute({store:f.store,scope,command,authorize:auth,perform});
 await assert.rejects(execute({store:f.store,scope,command,authorize:async()=>false,perform}),{code:'FORBIDDEN'});
});
test('missing trusted context fails closed',async()=>assert.rejects(execute({store:{transaction(){}},scope:{tenantId:'bad'},command,authorize:auth,perform:async()=>({})}),{code:'INVALID_CONTEXT'}));
test('failed command is not recorded',async()=>{
 const f=fixture();
 await assert.rejects(execute({store:f.store,scope,command,authorize:auth,perform:async()=>{throw new Error('failed')}}));
 assert.equal(f.counts().commits,0);
});
