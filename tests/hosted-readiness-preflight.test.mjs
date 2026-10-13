import test from 'node:test';
import assert from 'node:assert/strict';
import {createHostedPreflight,validateHostedPreflight} from '../domain/hosted-readiness-preflight.mjs';
import {hostedPrerequisites,hostedScenarios} from '../domain/operations-release.mjs';
const sourceHash='a'.repeat(64);
const options={sourceHash};
test('B266: all hosted phases remain blocked without independently reviewed evidence',()=>{
 const r=createHostedPreflight(options);
 assert.equal(r.decision,'NO-GO');
 assert.equal(r.hostedExecuted,false);
 assert.equal(r.networkCalls,0);
 assert.equal(r.productionWrites,0);
 assert.equal(r.phases.length,5);
 assert.ok(r.phases.every(p=>p.status==='BLOCKED'&&p.missing.length>0));
 assert.deepEqual(r.scenarios.map(s=>s.id),hostedScenarios.map(s=>s.id));
 assert.equal(validateHostedPreflight(r,options).valid,true);
});
test('B266: unknown, malformed, and foreign-source review records fail closed',()=>{
 assert.throws(()=>createHostedPreflight({sourceHash,records:{unknown:{}}}));
 assert.throws(()=>createHostedPreflight({sourceHash,records:{[hostedPrerequisites[0]]:{decision:'APPROVED'}}}));
 const record={sourceHash:'b'.repeat(64),evidenceSha256:'c'.repeat(64),reviewerId:'reviewer-1',reviewedAt:'2026-10-13T00:00:00Z',decision:'APPROVED'};
 assert.throws(()=>createHostedPreflight({sourceHash,records:{[hostedPrerequisites[0]]:record}}));
});
test('B266: review metadata never becomes execution authorization',()=>{
 const records=Object.fromEntries(hostedPrerequisites.map(k=>[k,{sourceHash,evidenceSha256:'c'.repeat(64),reviewerId:'reviewer-1',reviewedAt:'2026-10-13T00:00:00Z',decision:'APPROVED'}]));
 const r=createHostedPreflight({sourceHash,records});
 assert.ok(r.phases.every(p=>p.missing.length===0));
 assert.ok(r.phases.every(p=>p.status==='BLOCKED'));
 assert.equal(r.executionAuthorized,false);
 assert.equal(r.decision,'NO-GO');
});
test('B266: modified reports are rejected',()=>{
 const r=createHostedPreflight(options);
 r.phases[0].status='PASS';
 assert.throws(()=>validateHostedPreflight(r,options),/PREFLIGHT_EVIDENCE_MISMATCH/);
});
