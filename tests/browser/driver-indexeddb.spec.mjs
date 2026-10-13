import {test,expect,signIn} from './workspace.mjs';

// B12: browser-native IndexedDB durability, isolated from live driver commands.
// This proves the storage primitive, not yet the application's offline queue wiring.
test('B12 browser IndexedDB survives page reload and closes cleanly',async({page,workspace})=>{
 await signIn(page,workspace,workspace.driver);
 const first=await page.evaluate(async()=>{
  const open=()=>new Promise((resolve,reject)=>{
   const r=indexedDB.open('iway-fcc03-browser-certification',1);
   r.onupgradeneeded=()=>r.result.createObjectStore('commands',{keyPath:'id'});
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  const db=await open();
  await new Promise((resolve,reject)=>{
   const tx=db.transaction('commands','readwrite');
   tx.objectStore('commands').put({id:'fixture-1',status:'queued'});
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
  db.close();return true;
 });
 expect(first).toBe(true);
 await page.reload();
 const result=await page.evaluate(async()=>{
  const db=await new Promise((resolve,reject)=>{
   const r=indexedDB.open('iway-fcc03-browser-certification',1);
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  const found=await new Promise((resolve,reject)=>{
   const tx=db.transaction('commands','readonly');
   const r=tx.objectStore('commands').get('fixture-1');
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  db.close();
  return found;
 });
 expect(result).toEqual({id:'fixture-1',status:'queued'});
 await page.evaluate(()=>new Promise((resolve,reject)=>{
  const r=indexedDB.deleteDatabase('iway-fcc03-browser-certification');
  r.onsuccess=resolve;r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('blocked'));
 }));
});
