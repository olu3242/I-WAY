import test from 'node:test';
import assert from 'node:assert/strict';
import {makeApp} from '../../server/app.mjs';
import {createSopHttpHandler} from '../http-handler.mjs';
async function serve(app,fn){await new Promise(r=>app.listen(0,'127.0.0.1',r));try{return await fn('http://127.0.0.1:'+app.address().port)}finally{await new Promise(r=>app.close(r))}}
test('B6: support endpoint fails closed when not configured',async()=>{
 await serve(makeApp(),async base=>{const r=await fetch(base+'/api/v1/support/tickets',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.equal(r.status,503)});
});
test('B6: unverified requests cannot create tickets',async()=>{
 let writes=0;
 const handler=createSopHttpHandler({verifySession:async()=>null,resolveResource:async()=>({tenantId:'t1'}),repository:{createTicketTransaction:async()=>{writes++}}});
 await serve(makeApp({sopHandler:handler}),async base=>{const r=await fetch(base+'/api/v1/support/tickets',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({subject:'Issue'})});assert.equal(r.status,401);assert.equal(writes,0)});
});
test('B6: client-supplied tenant and role cannot override trusted session',async()=>{
 const session={verified:true,tenantMembershipVerified:true,subjectId:'u1',tenantId:'t1',role:'driver'};
 let recorded;
 const handler=createSopHttpHandler({verifySession:async()=>session,resolveResource:async()=>({tenantId:'t1',ownerId:'u1'}),repository:{createTicketTransaction:async x=>{recorded=x;return {persisted:true,tenantId:'t1',ticketId:'ticket1'}}}});
 await serve(makeApp({sopHandler:handler}),async base=>{const r=await fetch(base+'/api/v1/support/tickets',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({subject:'Need assistance',tenantId:'attacker',role:'platform_admin'})});assert.equal(r.status,201);assert.equal(recorded.tenantId,'t1');assert.equal(recorded.actorId,'u1')});
});
test('B6: resource resolver cross tenant denial precedes repository writes',async()=>{
 let writes=0;
 const handler=createSopHttpHandler({verifySession:async()=>({verified:true,tenantMembershipVerified:true,subjectId:'u1',tenantId:'t1',role:'driver'}),resolveResource:async()=>({tenantId:'t2'}),repository:{createTicketTransaction:async()=>{writes++}}});
 await serve(makeApp({sopHandler:handler}),async base=>{const r=await fetch(base+'/api/v1/support/tickets',{method:'POST',headers:{'content-type':'application/json'},body:'{"subject":"Issue"}'});assert.equal(r.status,403);assert.equal(writes,0)});
});
