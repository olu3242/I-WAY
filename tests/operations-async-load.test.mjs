import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createAsyncLoad} from '../domain/operations-async-load.mjs';
const tenantId=randomUUID(),actorId=randomUUID(),dispatcherId=randomUUID(),customerId=randomUUID();
const scope={tenantId,actorId};
const command={action:'load:create',idempotencyKey:randomUUID(),payload:{
 reference:'LOAD-81',customer:'Test Customer',customerId,dispatcherId,commodity:'Freight',weightLb:1000,
 stops:[{type:'pickup',location:'Austin',at:'2026-11-01T10:00:00.000Z'},{type:'delivery',location:'Dallas',at:'2026-11-02T10:00:00.000Z'}],
 rateCents:100000,charges:[],factored:false
}};
function fixture({failShipment=false,dispatcherTenant=tenantId,authorized=true}={}){
 const persisted=[],commands=new Map();let auditCount=0;
 const store={async transaction(_scope,work){
  const staged=[],stagedCommands=new Map(commands);let stagedAudits=0;
  const tx={
   principal:async()=>({id:actorId,tenantId,active:true,role:'carrier'}),
   user:async()=>({id:dispatcherId,tenantId:dispatcherTenant,role:'dispatcher',active:true}),
   get:async()=>({id:customerId,tenantId,active:true}),
   insert:async(kind,data)=>{if(kind==='shipment'&&failShipment)throw Error('shipment insert failed');const row={...data,id:randomUUID(),tenantId,kind,version:1};staged.push(row);return row;},
   command:async key=>stagedCommands.get(key)??null,
   recordCommand:async(key,digest,result)=>{stagedCommands.set(key,{digest,result})},
   audit:async()=>{stagedAudits++}
  };
  const result=await work(tx);
  persisted.push(...staged);for(const [key,value] of stagedCommands)commands.set(key,value);
  auditCount+=stagedAudits;
  return result;
 }};
 return {store,rows:()=>persisted,audits:()=>auditCount,authorizeLoad:async()=>authorized};
}
test('load and shipment commit atomically and replay does not duplicate',async()=>{
 const f=fixture();const args={store:f.store,scope,command,authorizeLoad:f.authorizeLoad};
 const first=await createAsyncLoad(args);
 const replay=await createAsyncLoad(args);
 assert.deepEqual(replay,first);
 assert.deepEqual(f.rows().map(x=>x.kind),['load','shipment']);
 assert.equal(f.rows()[1].loadId,first.id);
 assert.equal(f.audits(),1);
});
test('shipment failure rolls back load and command',async()=>{
 const f=fixture({failShipment:true});
 await assert.rejects(createAsyncLoad({store:f.store,scope,command,authorizeLoad:f.authorizeLoad}),/shipment insert failed/);
 assert.equal(f.rows().length,0);assert.equal(f.audits(),0);
});
test('cross-tenant dispatcher rejected without writes',async()=>{
 const f=fixture({dispatcherTenant:randomUUID()});
 await assert.rejects(createAsyncLoad({store:f.store,scope,command,authorizeLoad:f.authorizeLoad}),{code:'INVALID_DISPATCHER'});
 assert.equal(f.rows().length,0);
});
test('authorization denial prevents writes',async()=>{
 const f=fixture({authorized:false});
 await assert.rejects(createAsyncLoad({store:f.store,scope,command,authorizeLoad:f.authorizeLoad}),{code:'FORBIDDEN'});
 assert.equal(f.rows().length,0);
});
test('unsupported action fails closed',async()=>{
 const f=fixture();
 await assert.rejects(createAsyncLoad({store:f.store,scope,command:{...command,action:'load:assign'},authorizeLoad:f.authorizeLoad}),{code:'UNSUPPORTED_COMMAND'});
});
