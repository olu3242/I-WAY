import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessPostgresParity as assess} from '../scripts/r4-postgres-parity-gate.mjs';
const good=()=>({environment:'hosted-nonproduction',commitSha:'a'.repeat(40),commands:{expected:72,tested:72,failed:0,missing:[]},tenantIsolation:{passed:true,assertions:5},rls:{passed:true,assertions:5},authentication:{passed:true,assertions:3},run:{evidenceDigest:'sha256:'+'b'.repeat(64),completedAt:'2026-10-19T12:00:00Z',syntheticFixtures:true},review:{approved:true,reviewer:'Independent QA',approvalReference:'QA-001'}});
test('R4 rejects absent hosted evidence',()=>assert.equal(assess(null).decision,'NO-GO'));
test('R4 rejects partial command coverage',()=>{const e=good();e.commands.tested=39;e.commands.missing=['tracking:record'];assert.equal(assess(e).decision,'NO-GO');});
test('R4 rejects missing RLS and tenant isolation',()=>{const e=good();e.rls.passed=false;e.tenantIsolation.assertions=0;assert.equal(assess(e).decision,'NO-GO');});
test('R4 rejects unapproved evidence',()=>{const e=good();e.review.approved=false;assert.equal(assess(e).decision,'NO-GO');});
test('R4 only makes complete evidence eligible for review',()=>assert.equal(assess(good()).decision,'ELIGIBLE_FOR_REVIEW'));

test('R4 rejects self-declared smaller inventories even when every declared command passes',()=>{const e=good();e.commands.expected=1;e.commands.tested=1;assert.equal(assess(e).decision,'NO-GO');});
test('R4 rejects a truncated inventory of 39 commands reported as complete',()=>{const e=good();e.commands.expected=39;e.commands.tested=39;assert.equal(assess(e).decision,'NO-GO');});
