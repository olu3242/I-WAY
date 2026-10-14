import test from 'node:test';
import assert from 'node:assert/strict';
import {makeApp} from '../../server/app.mjs';
import {createSopComposition} from '../composition.mjs';
const member={active:true,tenantId:'tenantA',role:'driver'};
async function run(app,fn){await new Promise(r=>app.listen(0,'127.0.0.1',r));try{return await fn('http://127.0.0.1:'+app.address().port)}finally{await new Promise(r=>app.close(r))}}
test('B12-B14: authenticated HTTP creates ticket using request-scoped SQL identity',async()=>{
 const queries=[];
 const pool={async connect(){return {async query(sql,args){queries.push({sql,args});if(sql.startsWith('INSERT INTO iway_private.sop_tickets'))return {rowCount:1,rows:[{id:'ticket1',tenant_id:'tenantA'}]};return {rows:[],rowCount:0}},release(){}}}};
 const handler=createSopComposition({verifyBearerToken:async token=>token==='valid'?{active:true,subjectId:'driver1'}:null,lookupMembership:async()=>member,pool,resolveResource:async({session})=>({tenantId:session.tenantId,ownerId:session.subjectId})});
 await run(makeApp({sopHandler:handler}),async base=>{
  const r=await fetch(base+'/api/v1/support/tickets',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer valid'},body:JSON.stringify({subject:'Need help',priority:'P3',tenantId:'tenantB'})});
  assert.equal(r.status,201);
  assert.equal((await r.json()).ticketId,'ticket1');
 });
 assert.equal(queries[0].sql,'BEGIN');
 assert.equal(queries[1].args[1],'tenantA');
 assert.equal(queries[1].args[3],'driver1');
 assert.equal(queries.at(-1).sql,'COMMIT');
});
test('B12-B14: missing membership blocks SQL and HTTP',async()=>{
 let connects=0;
 const handler=createSopComposition({verifyBearerToken:async()=>({active:true,subjectId:'driver1'}),lookupMembership:async()=>null,pool:{async connect(){connects++}},resolveResource:async()=>({tenantId:'tenantA'})});
 await run(makeApp({sopHandler:handler}),async base=>{
  const r=await fetch(base+'/api/v1/support/tickets',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer valid'},body:'{"subject":"Need help"}'});
  assert.equal(r.status,401);
 });
 assert.equal(connects,0);
});
