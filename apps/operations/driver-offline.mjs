import {validateOfflineCommand,MAX_OFFLINE_COMMANDS} from '../../domain/driver-offline-replay.mjs';

// Only minimal pseudonymous command envelopes and fixed delivery-state labels.
// Never persist session/CSRF tokens, names, locations, documents or proofs.
export function indexedQueue(indexedDB=globalThis.indexedDB){
 let connection;
 const db=()=>connection??=new Promise((resolve,reject)=>{const r=indexedDB.open('iway-driver-queue-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('commands',{keyPath:'envelope.idempotencyKey'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('OFFLINE_STORAGE_UNAVAILABLE'));});
 async function transaction(mode,run){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('commands',mode),store=tx.objectStore('commands');let result;tx.oncomplete=()=>resolve(result);tx.onabort=tx.onerror=()=>reject(Error('OFFLINE_STORAGE_UNAVAILABLE'));run(store,value=>result=value,tx);});}
 return {list:()=>transaction('readonly',(s,done)=>{const r=s.getAll();r.onsuccess=()=>done(r.result.sort((a,b)=>a.envelope.createdAt-b.envelope.createdAt));}),
  put:row=>transaction('readwrite',(s,done,tx)=>{const r=s.getAll();r.onsuccess=()=>{const rows=r.result;if(rows.length>=MAX_OFFLINE_COMMANDS&&!rows.some(x=>x.envelope.idempotencyKey===row.envelope.idempotencyKey)){tx.abort();return;}s.put(row);};}),
  remove:key=>transaction('readwrite',s=>s.delete(key)),clear:()=>transaction('readwrite',s=>s.clear())};
}
export function createDriverQueue({storage,readSession,send,clock=()=>Date.now(),notify=()=>{}}){
 let busy=false;
 const locked=fn=>globalThis.navigator?.locks?navigator.locks.request('iway-driver-queue',fn):fn();
 async function list(context){const rows=await storage.list(),valid=[];for(const row of rows){try{validateOfflineCommand(row.envelope,context,clock());if(!['queued','sending','needs_attention'].includes(row.status))throw Error();valid.push(row);}catch{await storage.remove(row.envelope?.idempotencyKey);}}return valid;}
 async function enqueue(context,command){
  const envelope=validateOfflineCommand({schemaVersion:1,...context,...command,createdAt:clock()},context,clock());
  return locked(async()=>{const rows=await list(context);if(rows.some(r=>r.envelope.resourceId===envelope.resourceId))throw Error('OFFLINE_ALREADY_QUEUED');if(rows.length>=MAX_OFFLINE_COMMANDS)throw Error('OFFLINE_QUEUE_LIMIT');await storage.put({envelope,status:'queued'});notify('Queued on device. The server has not confirmed this action.');return envelope;});
 }
 async function replay(){if(busy)return {status:'sending'};busy=true;try{return await locked(async()=>{
  let session;try{session=await readSession();}catch{notify('Sign in online before retrying queued actions.');return {status:'needs_attention'};}
  const prior=await storage.list(),rows=await list(session.context),confirmed=[];
  if(prior.length!==rows.length){notify('Expired actions or actions from a changed account were discarded. Review your current assignment.');return {status:'needs_attention',confirmed};}
  for(const row of rows){
   try{
    const fresh=await readSession();validateOfflineCommand(row.envelope,fresh.context,clock());
    await storage.put({...row,status:'sending'});notify('Sending queued action. Awaiting server confirmation.');
    const receipt=await send(row.envelope,fresh.csrf);
    if(receipt?.confirmed!==true||receipt.idempotencyKey!==row.envelope.idempotencyKey)throw Error('OFFLINE_UNCONFIRMED');
    await storage.remove(row.envelope.idempotencyKey);confirmed.push(receipt);notify('Confirmed by server.');
   }catch{await storage.put({...row,status:'needs_attention'});notify('Needs attention. Review your session and current assignment before retrying.');return {status:'needs_attention',confirmed};}
  }return {status:'confirmed_by_server',confirmed};
 });}finally{busy=false;}}
 return {enqueue,replay,list,clear:()=>locked(()=>storage.clear()),cancel:key=>locked(()=>storage.remove(key))};
}

if(typeof document!=='undefined'){
 const storage=indexedQueue();let context,queue,region,generation=0;
 const announce=text=>{if(region){const status=region.querySelector('.queue-status');status.textContent=text;}};
 const readSession=async()=>{const r=await fetch('/api/ops/offline/context',{cache:'no-store'});if(!r.ok)throw Error('OFFLINE_SIGN_IN_REQUIRED');return r.json();};
 queue=createDriverQueue({storage,readSession,send:async(entry,csrf)=>{const r=await fetch('/api/ops/offline',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify(entry)});if(!r.ok)throw Error('OFFLINE_REPLAY_DENIED');return r.json();},notify:announce});
 async function localRows(){const valid=[];for(const row of await storage.list()){try{validateOfflineCommand(row.envelope,{actorId:row.envelope.actorId,tenantId:row.envelope.tenantId,authorityFingerprint:row.envelope.authorityFingerprint});valid.push(row);}catch{await storage.remove(row.envelope?.idempotencyKey);}}return valid;}
 async function draw(){
  if(!region)return;const rows=context?await queue.list(context):await localRows();
  const list=region.querySelector('ul');list.replaceChildren();
  for(const row of rows){const li=document.createElement('li'),label=document.createElement('span'),cancel=document.createElement('button');label.textContent=({queued:'Queued on device',sending:'Sending',needs_attention:'Needs attention'})[row.status]??'Needs attention';label.textContent+=' · '+({'load:accept':'Accept assignment','load:pickup':'Complete pickup','load:transit':'Start transit'})[row.envelope.action];cancel.type='button';cancel.textContent='Cancel queued action';cancel.addEventListener('click',async()=>{await queue.cancel(row.envelope.idempotencyKey);await draw();announce('Queued action cancelled on this device.');region.querySelector('h2').focus();});li.append(label,cancel);list.append(li);}
  region.querySelector('[data-retry]').disabled=!rows.length||!navigator.onLine;
 }
 async function connect(state){
  const turn=++generation;
  if(state.actor.role!=='driver'){await queue.clear();region?.remove();region=null;context=null;return;}
  if(!region){region=document.createElement('section');region.className='card offline-queue';region.setAttribute('aria-label','Device action queue');region.innerHTML='<h2 tabindex="-1">Device action queue</h2><p class="queue-status" aria-live="polite">Only status actions are stored. Delivery, documents and signatures require an online connection.</p><ul></ul><button type="button" data-retry>Retry queued actions</button>';document.querySelector('#main').prepend(region);region.querySelector('[data-retry]').addEventListener('click',async()=>{await queue.replay();await draw();document.dispatchEvent(new Event('iway:offline-confirmed'));});}
  try{const fresh=await readSession();if(turn!==generation)return;context=fresh.context;}catch{announce('Connect and sign in to prepare offline status actions.');}await draw();
 }
 window.iwayOffline={connect,clear:async()=>{context=null;await queue.clear();await draw();},submit:async(action,record,payload,idempotencyKey)=>{
  if(!context)throw Error('Connect and sign in before using the device queue.');
  await queue.enqueue(context,{action,resourceId:record.id,expectedVersion:record.version,idempotencyKey,payload});await draw();
  if(navigator.onLine){const result=await queue.replay();await draw();const receipt=result.confirmed?.find(r=>r.idempotencyKey===idempotencyKey);if(receipt)return receipt.result;throw Error('This action was not confirmed. Review the device queue and current assignment.');}
  return {queuedOnDevice:true};
 }};
 document.addEventListener('iway:workspace',event=>connect(event.detail).catch(()=>announce('Device storage is unavailable. This action has not been queued.')));
 addEventListener('online',async()=>{await draw();announce('Connection restored. Retry queued actions after reviewing your current session.');});
 document.dispatchEvent(new Event('iway:offline-ready'));
 if(document.querySelector('[data-offline-shell]')){
  region=document.querySelector('[data-offline-shell]');region.querySelector('[data-retry]').addEventListener('click',async()=>{await queue.replay();await draw();});draw().catch(()=>announce('Device storage is unavailable.'));
 }
 if('serviceWorker'in navigator)navigator.serviceWorker.register('/driver-sw.js',{scope:'/'}).catch(()=>announce('Offline page support is unavailable.'));
}
