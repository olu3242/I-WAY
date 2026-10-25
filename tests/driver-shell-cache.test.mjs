import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const script=await readFile(new URL('../apps/operations/driver-sw.js',import.meta.url),'utf8');
async function install(patch={}){
 const events={},stored=[],requests=[];let opened=0;
 const type=path=>path==='/offline'?'text/html':path.endsWith('.css')?'text/css':path.endsWith('.woff2')?'font/woff2':'text/javascript';
 runInNewContext(script,{self:{addEventListener:(name,fn)=>events[name]=fn},caches:{open:async()=>{opened++;return {put:async path=>stored.push(path)};}},fetch:async(path,options)=>{
  requests.push({path,options});return {ok:true,redirected:false,headers:new Headers({'content-type':type(path)+'; charset=utf-8'}),...(path==='/assets/driver-offline.mjs'?patch:{})};
 }});
 let pending;events.install({waitUntil:promise=>{pending=promise;}});
 let error;try{await pending;}catch(e){error=e;}
 return {stored,requests,opened,error};
}
test('driver shell caches only validated static responses and disallows redirects',async()=>{
 const result=await install();assert.equal(result.error,undefined);assert.equal(result.stored.length,5);
 assert.ok(result.stored.every(path=>!path.startsWith('/api/')&&!path.startsWith('/auth/')));
 assert.ok(result.requests.every(({options})=>options.redirect==='error'&&options.cache==='no-store'));
});
test('sign-in HTML, redirects and failed assets cannot populate recovery cache',async()=>{
 for(const patch of [{ok:false},{redirected:true},{headers:new Headers({'content-type':'text/html'})},{headers:new Headers()}]){
  const result=await install(patch);assert.equal(result.error?.message,'OFFLINE_SHELL_UNAVAILABLE: /assets/driver-offline.mjs');assert.equal(result.opened,0);assert.deepEqual(result.stored,[]);
 }
});
