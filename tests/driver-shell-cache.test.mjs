import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const script=await readFile(new URL('../apps/operations/driver-sw.js',import.meta.url),'utf8');
async function install(patch={}){
 const events={},stored=[],requests=[];let opened=0;
 const type=path=>path==='/offline'?'text/html':path.endsWith('.css')?'text/css':path.endsWith('.woff2')?'font/woff2':'text/javascript';
 runInNewContext(script,{Response,self:{addEventListener:(name,fn)=>events[name]=fn},caches:{open:async()=>{opened++;return {put:async path=>stored.push(path)};}},fetch:async(path,options)=>{
  requests.push({path,options});return {ok:true,status:200,redirected:false,arrayBuffer:async()=>new ArrayBuffer(0),headers:new Headers({'content-type':type(path)+'; charset=utf-8'}),...(path==='/assets/driver-offline.mjs'?patch:{})};
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

test('installation drains response bodies before waiting for connection-limited assets',async()=>{
 const events={},stored=[];let active=0;const waiting=[];
 runInNewContext(script,{Response,self:{addEventListener:(name,fn)=>events[name]=fn},caches:{open:async()=>({put:async(path,response)=>{stored.push([path,await response.text()]);}})},fetch:async path=>{
  if(active===2)await new Promise(resolve=>waiting.push(resolve));
  active++;
  const type=path==='/offline'?'text/html':path.endsWith('.css')?'text/css':path.endsWith('.woff2')?'font/woff2':'text/javascript';
  return {ok:true,status:200,redirected:false,headers:new Headers({'content-type':type}),arrayBuffer:async()=>{active--;waiting.shift()?.();return new TextEncoder().encode(path).buffer;}};
 }});
 let pending;events.install({waitUntil:promise=>pending=promise});
 let timer;try{await Promise.race([pending,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Unread response blocked installation')),1000);})]);}finally{clearTimeout(timer);}
 assert.equal(stored.length,5);assert.ok(stored.every(([path,body])=>path===body));
});
