import test from 'node:test';
import assert from 'node:assert/strict';
import {createSopComposition} from '../composition.mjs';
import {makeApp} from '../../server/app.mjs';
test('B11: composition refuses missing trusted dependencies',()=>{
 assert.throws(()=>createSopComposition({}),/SOP_COMPOSITION_DEPENDENCIES_REQUIRED/);
});
test('B11: staged composition denies unverified bearer requests',async()=>{
 const handler=createSopComposition({verifyBearerToken:async()=>null,lookupMembership:async()=>null,pool:{connect:async()=>{throw Error('unexpected')}},resolveResource:async()=>({tenantId:'t1'})});
 const app=makeApp({sopHandler:handler});
 await new Promise(r=>app.listen(0,'127.0.0.1',r));
 try{
  const response=await fetch('http://127.0.0.1:'+app.address().port+'/api/v1/support/tickets',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer invalid'},body:'{"subject":"test"}'});
  assert.equal(response.status,401);
 }finally{await new Promise(r=>app.close(r))}
});
