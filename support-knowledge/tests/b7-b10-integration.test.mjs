import test from 'node:test';
import assert from 'node:assert/strict';
import {createBoundSopRepository} from '../bound-repository.mjs';
import {createSopSessionVerifier} from '../session-verifier.mjs';
import {createSopClient} from '../../site/public/assets/js/sop-client.js';
const identity={verified:true,tenantMembershipVerified:true,subjectId:'u1',tenantId:'t1',role:'driver'};
test('B7: repository denies mismatched tenant before opening DB connection',async()=>{
 let connections=0;const repository=createBoundSopRepository({async connect(){connections++}},identity);
 await assert.rejects(()=>repository.listApprovedArticles({tenantId:'t2',role:'driver'}),/SOP_IDENTITY_MISMATCH/);
 assert.equal(connections,0);
});
test('B7: repository binds tenant context inside SQL transaction',async()=>{
 const calls=[];const pool={async connect(){return {async query(sql,args){calls.push({sql,args});return {rows:[],rowCount:0}},release(){}}}};
 await createBoundSopRepository(pool,identity).listApprovedArticles({tenantId:'t1',role:'driver'});
 assert.deepEqual(calls.map(x=>x.sql).slice(0,2),['BEGIN','SELECT set_config($1,$2,true),set_config($3,$4,true)']);
 assert.equal(calls.at(-1).sql,'COMMIT');
});
test('B8: token verification and membership are required',async()=>{
 const verify=createSopSessionVerifier({verifyBearerToken:async()=>({active:true,subjectId:'u1'}),lookupMembership:async()=>({active:true,tenantId:'t1',role:'driver'})});
 assert.equal(await verify({headers:{authorization:'Bearer abc'}}).then(x=>x.tenantId),'t1');
 assert.equal(await verify({headers:{authorization:'Bearer bad token'}}),null);
 assert.equal(await verify({headers:{}}),null);
});
test('B8: unverified membership cannot authorize session',async()=>{
 const verify=createSopSessionVerifier({verifyBearerToken:async()=>({active:true,subjectId:'u1'}),lookupMembership:async()=>({active:false,tenantId:'t1',role:'driver'})});
 assert.equal(await verify({headers:{authorization:'Bearer abc'}}),null);
});
test('B9: browser client sends bearer token but no tenant or role',async()=>{
 let sent;const client=createSopClient({getAccessToken:async()=> 'token',fetchImpl:async(url,opts)=>{sent={url,opts};return {ok:true,json:async()=>({status:'created'})}}});
 await client.createTicket('Help','P2');
 assert.equal(sent.url,'/api/v1/support/tickets');
 assert.equal(sent.opts.headers.authorization,'Bearer token');
 assert.deepEqual(JSON.parse(sent.opts.body),{subject:'Help',priority:'P2'});
});
test('B10: missing access token blocks frontend request',async()=>{
 let calls=0;const client=createSopClient({getAccessToken:async()=>null,fetchImpl:async()=>{calls++}});
 await assert.rejects(()=>client.resolve('help'),/SOP_AUTH_REQUIRED/);
 assert.equal(calls,0);
});
