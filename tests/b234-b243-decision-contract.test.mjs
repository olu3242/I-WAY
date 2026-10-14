import test from 'node:test';
import assert from 'node:assert/strict';
import {AUTONOMY,evaluateDecision} from '../lib/intelligence/decision-plane.mjs';

// B236/B242: contract-level regression gates for the existing decision plane.
// Eligibility is advisory; execution must remain in the authorized operations runtime.
const policy=()=>({tenantId:'tenant-a',enabled:true,allowedActions:['review_dispatch'],
 autonomyLevel:AUTONOMY.BOUNDED,minimumConfidence:0.8,maximumCost:50,version:'policy-7'});
const input=()=>({tenantId:'tenant-a',eventId:'event-1',action:'review_dispatch',
 confidence:0.95,estimatedCost:10,evidence:['load:v4','vehicle:v3']});

test('B236: a bounded decision is eligible for orchestration, never an execution receipt',()=>{
 const result=evaluateDecision(input(),policy());
 assert.equal(result.status,'ELIGIBLE_FOR_ORCHESTRATION');
 assert.equal(result.policyVersion,'policy-7');
 assert.deepEqual(result.evidence,['load:v4','vehicle:v3']);
 assert.equal(Object.hasOwn(result,'executed'),false);
});

test('B236: tenant mismatch, disabled policy, and unsupported actions fail closed',()=>{
 for(const p of [{...policy(),tenantId:'tenant-b'},{...policy(),enabled:false},
                  {...policy(),allowedActions:['other_action']}]){
  const result=evaluateDecision(input(),p);
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.reason,'POLICY_DENIED');
 }
});

test('B236: observation and advisory autonomy never become execution eligibility',()=>{
 for(const [level,status] of [[AUTONOMY.OBSERVE,'OBSERVED'],
                             [AUTONOMY.ADVISE,'ADVISED'],
                             [AUTONOMY.ASSIST,'DRAFTED'],
                             [AUTONOMY.HUMAN_GOVERNED,'APPROVAL_REQUIRED']]){
  assert.equal(evaluateDecision(input(),{...policy(),autonomyLevel:level}).status,status);
 }
});

test('B242: malformed confidence, cost, and evidence cannot reach orchestration',()=>{
 for(const patch of [{confidence:Infinity},{confidence:-0.01},{confidence:1.01},
                     {estimatedCost:-1},{estimatedCost:NaN},
                     {evidence:'unverified'},{evidence:[null]}]){
  assert.throws(()=>evaluateDecision({...input(),...patch},policy()),TypeError);
 }
});

test('B242: invalid thresholds and autonomy levels fail closed',()=>{
 for(const patch of [{autonomyLevel:5},{autonomyLevel:-1},{autonomyLevel:1.5},
                     {minimumConfidence:NaN},{minimumConfidence:1.1},
                     {maximumCost:-1},{maximumCost:Infinity}]){
  const result=evaluateDecision(input(),{...policy(),...patch});
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.reason,'INVALID_POLICY');
 }
});

test('B236: caller-owned evidence and policy are not mutated',()=>{
 const evidence=['sensor:1'];const d={...input(),evidence};const p=policy();
 const result=evaluateDecision(d,p);
 result.evidence.push('untrusted:2');
 assert.deepEqual(evidence,['sensor:1']);
 assert.deepEqual(p.allowedActions,['review_dispatch']);
});
