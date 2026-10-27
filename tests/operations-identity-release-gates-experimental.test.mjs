import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateIwayIdentityRelease,requiredReleaseGates} from '../server/operations-identity-release-gates.experimental.mjs';
test('B434 fixtures alone cannot authorize production',()=>{
 const result=evaluateIwayIdentityRelease({});
 assert.equal(result.decision,'NO_GO');
 assert.equal(result.productionAccessAuthorized,false);
 assert.deepEqual(result.missing,requiredReleaseGates);
});
test('B434 every missing hosted gate blocks readiness',()=>{
 const complete=Object.fromEntries(requiredReleaseGates.map(key=>[key,true]));
 for(const gate of requiredReleaseGates){
  const evidence={...complete,[gate]:false};
  assert.equal(evaluateIwayIdentityRelease(evidence).decision,'NO_GO',gate);
 }
 const result=evaluateIwayIdentityRelease(complete);
 assert.equal(result.decision,'READY_FOR_HUMAN_GO_REVIEW');
 assert.equal(result.productionAccessAuthorized,false);
});
