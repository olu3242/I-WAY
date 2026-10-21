import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateRecoveryReadiness,recoveryChecks} from '../server/operations-recovery-readiness.experimental.mjs';
test('B445 missing any recovery check blocks certification',()=>{
 const all=Object.fromEntries(recoveryChecks.map(k=>[k,true]));
 for(const key of recoveryChecks){
  const result=evaluateRecoveryReadiness({...all,[key]:false});
  assert.equal(result.status,'NOT_CERTIFIED',key);
  assert.ok(result.missing.includes(key));
 }
 assert.deepEqual(evaluateRecoveryReadiness({}).missing,recoveryChecks);
});
test('B445 passing isolated checks never grants hosted or production access',()=>{
 const all=Object.fromEntries(recoveryChecks.map(k=>[k,true]));
 const result=evaluateRecoveryReadiness(all);
 assert.equal(result.status,'ISOLATED_CI_READY');
 assert.equal(result.hostedCertified,false);
 assert.equal(result.productionAuthorized,false);
});
