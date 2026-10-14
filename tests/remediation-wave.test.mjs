import test from 'node:test';
import assert from 'node:assert/strict';
import {assessRemediationWave,remediationBatches} from '../domain/remediation-wave.mjs';
import {hostedScenarios} from '../domain/operations-release.mjs';
const sourceHash='a'.repeat(64);
const fixture=(batch)=>{const s=hostedScenarios.find(s=>s.id===remediationBatches[batch].scenario);return {batch,sourceHash,artifactSha256:'b'.repeat(64),observedAt:'2026-10-13T00:00:00.000Z',scope:'isolated-fixture',checks:Object.fromEntries((s?.checks??[]).map(k=>[k,true]))};};
test('B245-B255 all eleven batches fail closed without evidence',()=>{
 const r=assessRemediationWave({sourceHash});
 assert.equal(Object.keys(r.batches).length,11);
 assert.ok(Object.values(r.batches).every(v=>v.status==='BLOCKED'));
 assert.equal(r.hostedDecision,'NO-GO');assert.equal(r.hostedExecuted,false);assert.equal(r.networkCalls,0);
});
test('B245-B255 recorded fixture evidence never authorizes hosted execution',()=>{
 const evidence=Object.fromEntries(Object.keys(remediationBatches).map(k=>[k,fixture(k)]));
 const r=assessRemediationWave({sourceHash,evidence});
 assert.ok(Object.values(r.batches).every(v=>v.status==='LOCAL_FIXTURE_RECORDED'));
 assert.equal(r.localDecision,'PARTIAL');assert.equal(r.hostedDecision,'NO-GO');assert.equal(r.executionAuthorized,false);
 assert.equal(assessRemediationWave({sourceHash,evidence}).evidenceDigest,r.evidenceDigest);
});
test('B245-B255 stale source, missing assertions, and unknown metadata are rejected',()=>{
 assert.throws(()=>assessRemediationWave({sourceHash:'invalid'}),/SOURCE_HASH/);
 assert.throws(()=>assessRemediationWave({sourceHash,evidence:{B256:{}}}),/INVALID_BATCH/);
 const bad=fixture('B249');bad.checks.staleFenceDenied=false;
 assert.equal(assessRemediationWave({sourceHash,evidence:{B249:bad}}).batches.B249.status,'BLOCKED');
 const stale=fixture('B245');stale.sourceHash='c'.repeat(64);
 assert.equal(assessRemediationWave({sourceHash,evidence:{B245:stale}}).batches.B245.status,'BLOCKED');
 const extra={...fixture('B254'),password:'do-not-accept'};
 assert.equal(assessRemediationWave({sourceHash,evidence:{B254:extra}}).batches.B254.status,'BLOCKED');
});
