import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessTrackingPerformance as assess} from '../scripts/tracking-slo-gate.mjs';
const sample=()=>({environment:'isolated',commitSha:'abc123',fixtureDigest:'sha256:illustrative',concurrency:4,baseline:{p95Ms:220,requestsPerSecond:34,requests:192,errors:0},after:{p95Ms:210,requestsPerSecond:35,requests:192,errors:0},repeat:{p95Ms:215,requestsPerSecond:34,requests:192,errors:0},slo:{approved:true,maxP95Ms:250,minRequestsPerSecond:30,maxErrors:0}});
test('R6 rejects absent evidence and unapproved SLO',()=>{assert.equal(assess(null).decision,'NO-GO');const s=sample();s.slo.approved=false;assert.equal(assess(s).decision,'NO-GO');});
test('R6 detects observed tracking latency and throughput regression',()=>{const s=sample();s.after.p95Ms=483.28;s.after.requestsPerSecond=14.5;assert.equal(assess(s).decision,'NO-GO');assert.ok(assess(s).reasons.some(x=>x.includes('regressed')));});
test('R6 requires a valid repeat measurement',()=>{const s=sample();delete s.repeat.requests;assert.equal(assess(s).decision,'NO-GO');});
test('R6 produces review eligibility only for complete passing measurements',()=>{assert.equal(assess(sample()).decision,'ELIGIBLE_FOR_REVIEW');});
