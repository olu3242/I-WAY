import test from 'node:test';
import assert from 'node:assert/strict';
import {createDriverOfflineStorage} from '../apps/operations/driver-offline-storage.js';

// Deterministic IndexedDB contract fixture: shared database across reopened handles,
// asynchronous request completion and transaction completion.
function fakeIndexedDB(){
 const data=new Map();let initialized=false;
 const request=(run,tx)=>{
   const req={onsuccess:null,onerror:null,result:undefined};
   queueMicrotask(()=>{try{req.result=run();req.onsuccess?.();}catch(error){req.error=error;req.onerror?.();tx?.onerror?.();return;}
     if(tx)queueMicrotask(()=>tx.oncomplete?.());
   });return req;
 };
 const store=tx=>({
   getAll:()=>request(()=>[...data.values()].map(x=>structuredClone(x)),tx),
   get:key=>request(()=>structuredClone(data.get(key)),tx),
   add:value=>request(()=>{if(data.has(value.idempotencyKey))throw Error('ConstraintError');data.set(value.idempotencyKey,structuredClone(value));},tx),
   delete:key=>request(()=>{data.delete(key);},tx),
   clear:()=>request(()=>{data.clear();},tx)
 });
 const db={objectStoreNames:{contains:()=>initialized},createObjectStore:()=>{initialized=true;},
   transaction:()=>{const tx={oncomplete:null,onerror:null,onabort:null,abort(){queueMicrotask(()=>tx.onabort?.());}};tx.objectStore=()=>store(tx);return tx;},
   close(){}};
 return {open:()=>{const req={result:db,onupgradeneeded:null,onsuccess:null,onerror:null};queueMicrotask(()=>{if(!initialized)req.onupgradeneeded?.();req.onsuccess?.();});return req;}};
}
const identity={tenantId:'tenant_1',actorId:'driver_1'};
const cmd=(id='550e8400-e29b-41d4-a716-446655440000')=>({schemaVersion:1,...identity,action:'load:accept',resourceId:'load_1',expectedVersion:1,idempotencyKey:id,createdAt:1000,payload:{}});
test('IndexedDB queue survives handle closure and reopen',async()=>{
 const indexedDB=fakeIndexedDB(),now=()=>1000;
 const first=createDriverOfflineStorage({indexedDB,context:identity,now});
 await first.enqueue(cmd());await first.close();
 const reopened=createDriverOfflineStorage({indexedDB,context:identity,now});
 assert.equal((await reopened.list()).length,1);
 await reopened.acknowledge(cmd().idempotencyKey);
 assert.deepEqual(await reopened.list(),[]);
});
test('cross actor cannot list or acknowledge queued command',async()=>{
 const indexedDB=fakeIndexedDB(),now=()=>1000;
 const owner=createDriverOfflineStorage({indexedDB,context:identity,now});
 await owner.enqueue(cmd());
 const other=createDriverOfflineStorage({indexedDB,context:{...identity,actorId:'driver_2'},now});
 await assert.rejects(other.list(),/IDENTITY/);
 await assert.rejects(other.acknowledge(cmd().idempotencyKey),/STORAGE_FAILURE/);
 assert.equal((await owner.list()).length,1);
});
test('purge clears queue after logout',async()=>{
 const indexedDB=fakeIndexedDB(),now=()=>1000;
 const queue=createDriverOfflineStorage({indexedDB,context:identity,now});
 await queue.enqueue(cmd());await queue.purge();assert.deepEqual(await queue.list(),[]);
});
test('rejects missing browser storage',async()=>{
 const queue=createDriverOfflineStorage({indexedDB:null,context:identity});
 await assert.rejects(queue.list(),/STORAGE_UNAVAILABLE/);
});

test('B14 foreign actor cannot purge owner queued commands',async()=>{
 const indexedDB=fakeIndexedDB(),now=()=>1000;
 const owner=createDriverOfflineStorage({indexedDB,context:identity,now});
 await owner.enqueue(cmd());
 const foreign=createDriverOfflineStorage({indexedDB,context:{...identity,actorId:'driver_2'},now});
 await assert.rejects(foreign.purge(),/STORAGE_FAILURE/);
 assert.equal((await owner.list()).length,1);
});
test('B14 tenant mismatch cannot enqueue into another tenant queue',async()=>{
 const indexedDB=fakeIndexedDB(),now=()=>1000;
 const owner=createDriverOfflineStorage({indexedDB,context:identity,now});
 await owner.enqueue(cmd());
 const foreign=createDriverOfflineStorage({indexedDB,context:{...identity,tenantId:'tenant_2'},now});
 await assert.rejects(foreign.enqueue({...cmd('550e8400-e29b-41d4-a716-446655440001'),tenantId:'tenant_2'}),/STORAGE_FAILURE/);
 assert.equal((await owner.list()).length,1);
});
