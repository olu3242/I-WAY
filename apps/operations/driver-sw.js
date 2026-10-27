// Cache this static recovery shell only. Never cache APIs, Auth, documents,
// personalized HTML, customer/load data, request bodies or credentials.
const CACHE='iway-driver-shell-v4',STATIC=['/assets/InterVariable.woff2','/offline','/assets/ops.css','/assets/driver-offline.mjs','/domain/driver-offline-replay.mjs'];
async function installShell(){
 // Authentication expiry can redirect these protected paths to HTML sign-in.
 // Validate the entire response set before storing any recovery asset.
 const responses=await Promise.all(STATIC.map(async path=>{
  const response=await fetch(path,{redirect:'error',cache:'no-store'});
  const type=response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  const expected=path==='/offline'?['text/html']:path.endsWith('.css')?['text/css']:path.endsWith('.woff2')?['font/woff2','application/font-woff2']:['text/javascript','application/javascript'];
  if(!response.ok||response.redirected||!expected.includes(type))throw Error('OFFLINE_SHELL_UNAVAILABLE: '+path);
  // Drain each body before waiting for the other assets; unread streams can
  // exhaust browser connections during installation. Cache only after all pass.
  return new Response(await response.arrayBuffer(),{status:response.status,headers:response.headers});
 }));
 const cache=await caches.open(CACHE);
 await Promise.all(STATIC.map((path,index)=>cache.put(path,responses[index])));
}
self.addEventListener('install',event=>event.waitUntil(installShell()));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('iway-driver-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(url.origin!==self.location.origin||event.request.method!=='GET')return;
 if(STATIC.includes(url.pathname)&&!url.search){event.respondWith(fetch(event.request).catch(()=>caches.match(url.pathname)));return;}
 if(event.request.mode==='navigate'&&url.pathname==='/app'&&!url.search)event.respondWith(fetch(event.request).catch(()=>caches.match('/offline')));
});
