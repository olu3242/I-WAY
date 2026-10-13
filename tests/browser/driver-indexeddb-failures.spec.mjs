import {test,expect,signIn} from './workspace.mjs';

// B13 real-browser failure path: a blocked upgrade must not be treated as success.
test('B13 blocked IndexedDB upgrade waits for old handle to close',async({page,workspace})=>{
 await signIn(page,workspace,workspace.driver);
 const outcome=await page.evaluate(async()=>{
  const name='iway-fcc03-b13-upgrade';
  const open=(version)=>new Promise((resolve,reject)=>{
   const r=indexedDB.open(name,version);
   r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('commands'))r.result.createObjectStore('commands');};
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  const old=await open(1);
  let blocked=false;
  const request=indexedDB.open(name,2);
  request.onblocked=()=>{blocked=true;old.close();};
  request.onupgradeneeded=()=>{};
  const upgraded=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  upgraded.close();old.close();
  await new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase(name);r.onsuccess=resolve;r.onerror=()=>reject(r.error);});
  return blocked;
 });
 expect(outcome).toBe(true);
});
test('B13 aborted transaction does not persist its command',async({page,workspace})=>{
 await signIn(page,workspace,workspace.driver);
 const result=await page.evaluate(async()=>{
  const name='iway-fcc03-b13-abort';
  const db=await new Promise((resolve,reject)=>{
   const r=indexedDB.open(name,1);r.onupgradeneeded=()=>r.result.createObjectStore('commands');
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  const aborted=await new Promise(resolve=>{
   const tx=db.transaction('commands','readwrite');
   tx.objectStore('commands').put({status:'queued'},'fixture');
   tx.onabort=()=>resolve(true);
   tx.abort();
  });
  const missing=await new Promise((resolve,reject)=>{
   const r=db.transaction('commands','readonly').objectStore('commands').get('fixture');
   r.onsuccess=()=>resolve(r.result===undefined);r.onerror=()=>reject(r.error);
  });
  db.close();
  await new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase(name);r.onsuccess=resolve;r.onerror=()=>reject(r.error);});
  return {aborted,missing};
 });
 expect(result).toEqual({aborted:true,missing:true});
});
