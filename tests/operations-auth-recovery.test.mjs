import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {observeAuthRequest} from '../server/operations-auth-observability.mjs';
import {createAuthMaintenance} from '../server/operations-auth-maintenance.mjs';
test('observability emits bounded safe fields and ignores attacker correlation data',()=>{
 const events=[],res=new EventEmitter();res.statusCode=401;
 const observation=observeAuthRequest({url:'/auth/callback?code=SECRET&state=SECRET',headers:{cookie:'SECRET','x-request-id':'SECRET'}},res,event=>events.push(event));
 res.emit('finish');res.emit('close');assert.equal(events.length,1);
 assert.match(observation.requestId,/^[0-9a-f-]{36}$/);assert.equal(events[0].route,'callback');
 assert.deepEqual(Object.keys(events[0]).sort(),['durationMs','event','requestId','route','status']);
 assert.equal(JSON.stringify(events).includes('SECRET'),false);
 const aborted=new EventEmitter();observeAuthRequest({url:'/sensitive-user-input'},aborted,e=>events.push(e));aborted.emit('close');
 assert.equal(events[1].route,'unknown');assert.equal(events[1].status,499);
 const broken=new EventEmitter();observeAuthRequest({},broken,()=>{throw Error('sink outage');});assert.doesNotThrow(()=>broken.emit('finish'));
});
test('maintenance coalesces requests, retries failures and resumes after interval',async()=>{
 let now=0,expired=0,recovered=0,release,fail=false;
 const barrier=new Promise(r=>release=r);
 const maintain=createAuthMaintenance({clock:()=>now,transactions:{expire:async()=>{expired++;if(expired===1)await barrier;if(fail)throw Error('DB down');}},sessions:{recoverStale:async()=>{recovered++;}}});
 const pending=[maintain(),maintain(),maintain()];release();await Promise.all(pending);
 assert.equal(expired,1);assert.equal(recovered,1);await maintain();assert.equal(expired,1);
 now=30001;fail=true;await assert.rejects(maintain(),/DB down/);assert.equal(recovered,1);
 fail=false;await maintain();assert.equal(expired,3);assert.equal(recovered,2);
});
