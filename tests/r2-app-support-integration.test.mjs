import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {makeApp} from '../server/app.mjs';

async function withServer(options, run) {
 const server = makeApp({root:'site/public',register:async()=>({created:true}),...options});
 server.listen(0,'127.0.0.1');
 await once(server,'listening');
 try {
  const {port}=server.address();
  await run('http://127.0.0.1:'+port);
 } finally {
  await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
 }
}

test('support routes fail closed without handler',async()=>{
 await withServer({},async base=>{
  const response=await fetch(base+'/api/v1/support/example');
  assert.equal(response.status,503);
  assert.deepEqual(await response.json(),{error:'support_unavailable'});
 });
});

test('support requests delegate to configured handler',async()=>{
 let seen;
 await withServer({sopHandler:(req,res,url)=>{
  seen={method:req.method,path:url.pathname};
  res.writeHead(202,{'Content-Type':'application/json'});
  res.end(JSON.stringify({delegated:true}));
 }},async base=>{
  const response=await fetch(base+'/api/v1/support/tickets',{method:'POST'});
  assert.equal(response.status,202);
  assert.deepEqual(await response.json(),{delegated:true});
 });
 assert.deepEqual(seen,{method:'POST',path:'/api/v1/support/tickets'});
});

test('health route remains available',async()=>{
 await withServer({},async base=>{
  const response=await fetch(base+'/api/health');
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{status:'ok'});
 });
});

test('non-support registration still uses injected handler',async()=>{
 let invoked=0;
 await withServer({register:async input=>{invoked++;assert.equal(input.email,'qa@example.com');return {created:true}}},async base=>{
  const response=await fetch(base+'/api/early-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'qa@example.com'})});
  assert.equal(response.status,201);
 });
 assert.equal(invoked,1);
});

test('registration rejects invalid JSON without invoking storage',async()=>{
 let invoked=0;
 await withServer({register:async()=>{invoked++;return {created:true}}},async base=>{
  const response=await fetch(base+'/api/early-access',{method:'POST',headers:{'Content-Type':'application/json'},body:'{invalid'});
  assert.equal(response.status,400);
 });
 assert.equal(invoked,0);
});

test('registration returns service unavailable when persistence fails',async()=>{
 await withServer({register:async()=>{throw new Error('Database offline')}},async base=>{
  const response=await fetch(base+'/api/early-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Test',email:'qa@example.com',role:'other',consent:true})});
  assert.equal(response.status,503);
  assert.deepEqual(await response.json(),{error:'Registration unavailable'});
 });
});

test('registration responds with existing status for duplicate lead',async()=>{
 await withServer({register:async()=>({created:false})},async base=>{
  const response=await fetch(base+'/api/early-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Test',email:'qa@example.com',role:'other',consent:true})});
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{status:'received'});
 });
});
