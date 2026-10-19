import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {renameAsyncLoad} from '../domain/operations-async-load-rename.mjs';
const scope={tenantId:randomUUID(),actorId:randomUUID()},id=randomUUID();
function fixture(){
 let load={id,tenantId:scope.tenantId,kind:'load',version:1,reference:'Original'},audit=0;const commands=new Map();
 const store={async transaction(_scope,work){
  let staged={...load},count=0;const pending=new Map(commands);
  const tx={principal:async()=>({id:scope.actorId,tenantId:scope.tenantId,active:true}),command:async key=>pending.get(key),
   get:async(kind,key)=>{assert.equal(kind,'load');if(key!==id)throw Error('NOT_FOUND');return staged},
   update:async(kind,key,version,patch)=>{assert.equal(kind,'load');if(key!==id||version!==staged.version)throw Object.assign(Error('STALE'),{code:'STALE'});staged={...staged,...patch,version:version+1};return staged},
   recordCommand:async(key,digest,result)=>{pending.set(key,{digest,result})},audit:async()=>{count++}};
  const result=await work(tx);load=staged;commands.clear();for(const [k,v] of pending)commands.set(k,v);audit+=count;return result;
 }};
 return {store,get:()=>load,audits:()=>audit};
}
const cmd=()=>({action:'load:rename',resourceId:id,expectedVersion:1,idempotencyKey:randomUUID(),payload:{reference:'Updated'}});
test('rename commits once and idempotent replay preserves version',async()=>{
 const f=fixture(),command=cmd(),args={store:f.store,scope,command,authorizeLoad:async()=>true};
 const first=await renameAsyncLoad(args);assert.equal(first.reference,'Updated');assert.equal(first.version,2);
 assert.deepEqual(await renameAsyncLoad(args),first);assert.equal(f.get().version,2);assert.equal(f.audits(),1);
});
test('rename denies unauthorized actor before mutation',async()=>{
 const f=fixture();await assert.rejects(renameAsyncLoad({store:f.store,scope,command:cmd(),authorizeLoad:async()=>false}),{code:'FORBIDDEN'});assert.equal(f.get().version,1);
});
test('rename rejects stale expected version without writes',async()=>{
 const f=fixture();await assert.rejects(renameAsyncLoad({store:f.store,scope,command:{...cmd(),expectedVersion:2},authorizeLoad:async()=>true}),{code:'STALE'});assert.equal(f.audits(),0);
});
test('rename rejects extra payload fields',async()=>{
 const f=fixture();await assert.rejects(renameAsyncLoad({store:f.store,scope,command:{...cmd(),payload:{reference:'Changed',tenantId:randomUUID()}},authorizeLoad:async()=>true}),{code:'FIELDS'});assert.equal(f.get().version,1);
});
test('rename rejects unsupported action and missing authorizer',async()=>{
 const f=fixture();await assert.rejects(renameAsyncLoad({store:f.store,scope,command:{...cmd(),action:'load:delete'},authorizeLoad:async()=>true}),{code:'UNSUPPORTED_COMMAND'});
 await assert.rejects(renameAsyncLoad({store:f.store,scope,command:cmd()}),{code:'AUTHORIZATION_NOT_CONFIGURED'});
});
