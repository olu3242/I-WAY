import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createGovernedTrackingProjection} from '../server/operations-tracking-adapter.mjs';
const id=()=>randomUUID();
function setup(){
 const tenantId=id(),actorId=id(),shipmentId=id(),loadId=id();
 const principal={id:actorId,tenantId,role:'carrier',active:true,permissions:['load:view']};
 const shipment={id:shipmentId,tenantId,loadId},load={id:loadId,tenantId,kind:'load'};
 const tx={principal:async()=>principal,get:async kind=>kind==='shipment'?shipment:load,trackingHistory:async()=>[]};
 const store={transaction:async(scope,fn)=>fn(tx)};
 return {tenantId,actorId,shipmentId,principal,shipment,load,tx,store};
}
test('governed tracking adapter validates session and persisted principal',async()=>{
 const f=setup(),actor={...f.principal},scope={tenantId:f.tenantId,actorId:f.actorId};
 const run=(changes={})=>createGovernedTrackingProjection({store:f.store})({actor,scope,shipmentId:f.shipmentId,...changes});
 assert.equal((await run()).shipmentId,f.shipmentId);
 await assert.rejects(run({actor:{...actor,id:id()}}),{code:'UNAUTHORIZED'});
 await assert.rejects(run({scope:{...scope,tenantId:id()}}),{code:'UNAUTHORIZED'});
 await assert.rejects(run({actor:{...actor,active:false}}),{code:'UNAUTHORIZED'});
 f.principal.role='dispatcher';
 await assert.rejects(run(),{code:'FORBIDDEN'});
 f.principal.role='carrier';f.principal.permissions=[];
 await assert.rejects(run(),{code:'FORBIDDEN'});
 f.principal.permissions=['load:view'];f.load.tenantId=id();
 await assert.rejects(run(),{code:'FORBIDDEN'});
 f.load.tenantId=f.tenantId;
 await assert.rejects(run({actor:{...actor,permissions:[]}}),{code:'FORBIDDEN'});
 assert.equal((await run()).shipmentId,f.shipmentId);
});
test('governed adapter requires an async transactional store',()=>{
 assert.throws(()=>createGovernedTrackingProjection(),TypeError);
 assert.throws(()=>createGovernedTrackingProjection({store:{}}),TypeError);
});
