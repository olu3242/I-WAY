import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrustedRouteGuard} from '../server/operations-supabase-trusted-route-guard.experimental.mjs';
test('B467 binds route method and path to trusted tenant and role',async()=>{
 const seen=[];
 const guard=createTrustedRouteGuard({sessionGuard:async input=>{seen.push(input);return {ok:true,status:200,userId:'u'};},routes:[{method:'GET',path:'/api/fleet/tracking',tenantId:'tenant-a',role:'fleet'}]});
 assert.equal((await guard({method:'GET',path:'/api/fleet/tracking',headers:{cookie:'session=x'},tenantId:'tenant-b',role:'platform'})).ok,true);
 assert.deepEqual(seen[0],{headers:{cookie:'session=x'},tenantId:'tenant-a',role:'fleet'});
 assert.equal((await guard({method:'POST',path:'/api/fleet/tracking'})).status,404);
});
test('B467 rejects duplicate or incomplete route definitions',()=>{
 assert.throws(()=>createTrustedRouteGuard({sessionGuard:async()=>true,routes:[{method:'GET',path:'/api/a',tenantId:'a',role:'fleet'},{method:'GET',path:'/api/a',tenantId:'b',role:'fleet'}]}),/TRUSTED_ROUTE_DUPLICATE/);
 assert.throws(()=>createTrustedRouteGuard({sessionGuard:async()=>true,routes:[{method:'GET',path:'/api/a',tenantId:'',role:'fleet'}]}),/TRUSTED_ROUTE_INVALID/);
});
