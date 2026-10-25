// Cache this static recovery shell only. Never cache APIs, Auth, documents,
// personalized HTML, customer/load data, request bodies or credentials.
const CACHE='iway-driver-shell-v2',STATIC=['/assets/InterVariable.woff2','/offline','/assets/ops.css','/assets/driver-offline.mjs','/domain/driver-offline-replay.mjs'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(STATIC))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('iway-driver-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(url.origin!==self.location.origin||event.request.method!=='GET')return;
 if(STATIC.includes(url.pathname)&&!url.search){event.respondWith(fetch(event.request).catch(()=>caches.match(url.pathname)));return;}
 if(event.request.mode==='navigate'&&url.pathname==='/app'&&!url.search)event.respondWith(fetch(event.request).catch(()=>caches.match('/offline')));
});
