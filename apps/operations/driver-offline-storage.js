// FCC-03 B2-B3: durable, minimal offline command envelopes. Not activated in UI.
// IndexedDB is device-local storage, not a secret vault. Do not store credentials or POD.
import {validateOfflineQueue,validateOfflineCommand,MAX_OFFLINE_COMMANDS} from '../../domain/driver-offline-replay.mjs';

const DATABASE='iway-driver-offline-v1';
const STORE='commands';
const VERSION=1;
function openDatabase(indexedDB){
  if(!indexedDB || typeof indexedDB.open!=='function')throw new Error('OFFLINE_STORAGE_UNAVAILABLE');
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DATABASE,VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'idempotencyKey'});
    };
    req.onerror=()=>reject(new Error('OFFLINE_STORAGE_UNAVAILABLE'));
    req.onversionchange=()=>{try{req.result?.close();}catch{}};
    req.onblocked=()=>reject(new Error('OFFLINE_STORAGE_BLOCKED'));
    req.onsuccess=()=>resolve(req.result);
  });
}
function transaction(db,mode,work){
  return new Promise((resolve,reject)=>{
    let result;
    const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);
    tx.oncomplete=()=>resolve(result);
    tx.onerror=()=>reject(new Error('OFFLINE_STORAGE_FAILURE'));
    tx.onabort=()=>reject(new Error('OFFLINE_STORAGE_FAILURE'));
    try{work(store,value=>{result=value;},()=>tx.abort());}catch{tx.abort();}
  });
}
export function createDriverOfflineStorage({indexedDB,context,now=()=>Date.now()}={}){
  if(!context?.tenantId||!context?.actorId)throw new Error('OFFLINE_CONTEXT_REQUIRED');
  let dbPromise;
  const connect=()=>dbPromise??=openDatabase(indexedDB).catch(error=>{dbPromise=undefined;throw error;});
  const readAll=async()=>{const db=await connect();return transaction(db,'readonly',(store,set)=>{
    const req=store.getAll();req.onsuccess=()=>set(req.result);
  });};
  return Object.freeze({
    async list(){
      const all=await readAll();
      // Reject foreign entries instead of displaying or replaying them.
      return validateOfflineQueue(all,context,now()).sort((a,b)=>a.createdAt-b.createdAt);
    },
    async enqueue(command){
      const valid=validateOfflineCommand(command,context,now());
      const db=await connect();
      return transaction(db,'readwrite',(store,set,abort)=>{
        const req=store.getAll();
        req.onsuccess=()=>{
          const existing=req.result;
          if(existing.some(e=>e.tenantId!==context.tenantId||e.actorId!==context.actorId) ||
             existing.length>=MAX_OFFLINE_COMMANDS || existing.some(e=>e.idempotencyKey===valid.idempotencyKey)){
            abort();return;
          }
          store.add(valid);set(valid);
        };
      });
    },
    async acknowledge(key){
      const db=await connect();
      return transaction(db,'readwrite',(store,set,abort)=>{
        const req=store.get(key);
        req.onsuccess=()=>{
          if(!req.result||req.result.tenantId!==context.tenantId||req.result.actorId!==context.actorId){abort();return;}
          store.delete(key);set(true);
        };
      });
    },
    async purge(){
      // Clear the entire local queue on logout/account switch, including foreign entries.
      const db=await connect();
      return transaction(db,'readwrite',(store,set)=>{store.clear();set(true);});
    },
    async close(){if(dbPromise){const db=await dbPromise;db.close();dbPromise=undefined;}}
  });
}
