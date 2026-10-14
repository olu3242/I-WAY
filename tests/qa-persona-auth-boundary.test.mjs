import test from 'node:test';
import assert from 'node:assert/strict';
import {createQaPersonaAuthBoundary} from '../domain/qa-persona-auth-boundary.mjs';
test('identity is taken only from verified bearer',async()=>{
 const seen=[];
 const service={start:async value=>{seen.push(value);return {sessionId:'s'}},resolve:async value=>value,stop:async value=>value};
 const boundary=createQaPersonaAuthBoundary({verifyBearer:async token=>token==='valid'?{subjectId:'verified-id',active:true}:null,service});
 await boundary.start({headers:{authorization:'Bearer valid'},body:{authenticatedSubjectId:'forged'}},{targetId:'driver',reason:'QA test'});
 assert.equal(seen[0].authenticatedSubjectId,'verified-id');
 await assert.rejects(boundary.start({headers:{authorization:'Bearer invalid'}},{targetId:'driver'}),/QA_UNAUTHENTICATED/);
});
test('missing bearer rejected',async()=>{
 const boundary=createQaPersonaAuthBoundary({verifyBearer:async()=>null,service:{}});
 await assert.rejects(boundary.resolve({headers:{}},{sessionId:'x'}),/QA_UNAUTHENTICATED/);
});
