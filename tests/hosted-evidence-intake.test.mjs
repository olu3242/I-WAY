import test from 'node:test';
import assert from 'node:assert/strict';
import {assessHostedEvidenceIntake,validateHostedEvidenceIntake} from '../domain/hosted-evidence-intake.mjs';
import {hostedPrerequisites} from '../domain/operations-release.mjs';
const sourceHash='a'.repeat(64);
const record={sourceHash,evidenceSha256:'b'.repeat(64),reviewerId:'reviewer-1',reviewedAt:'2026-10-13T00:00:00Z',decision:'APPROVED'};
test('B267: missing evidence blocks all hosted phases',()=>{
 const r=assessHostedEvidenceIntake({sourceHash});
 assert.deepEqual(r.missing,hostedPrerequisites);
 assert.ok(r.phases.every(p=>p.status==='BLOCKED'));
 assert.equal(r.decision,'NO-GO');assert.equal(r.hostedExecuted,false);
 assert.equal(validateHostedEvidenceIntake(r,{sourceHash}).valid,true);
});
test('B268: review metadata does not independently verify evidence or authorize execution',()=>{
 const records=Object.fromEntries(hostedPrerequisites.map(k=>[k,{...record}]));
 const r=assessHostedEvidenceIntake({sourceHash,records});
 assert.equal(r.pendingIndependentVerification.length,hostedPrerequisites.length);
 assert.ok(r.phases.every(p=>p.status==='BLOCKED'));
 assert.equal(r.executionAuthorized,false);assert.equal(r.decision,'NO-GO');
});
test('B269: malformed, foreign source and unrecognized keys fail closed',()=>{
 assert.throws(()=>assessHostedEvidenceIntake({sourceHash,records:{bad:record}}));
 assert.throws(()=>assessHostedEvidenceIntake({sourceHash,records:{[hostedPrerequisites[0]]:{...record,sourceHash:'c'.repeat(64)}}}));
 assert.throws(()=>assessHostedEvidenceIntake({sourceHash,records:{[hostedPrerequisites[0]]:{...record,token:'secret'}}}));
});
test('B270: rejection remains rejected, never approved',()=>{
 const r=assessHostedEvidenceIntake({sourceHash,records:{[hostedPrerequisites[0]]:{...record,decision:'REJECTED'}}});
 assert.deepEqual(r.rejected,[hostedPrerequisites[0]]);
 assert.equal(r.decision,'NO-GO');
});
test('B271: changed evidence report is rejected',()=>{
 const r=assessHostedEvidenceIntake({sourceHash});r.decision='GO';
 assert.throws(()=>validateHostedEvidenceIntake(r,{sourceHash}),/INTAKE_EVIDENCE_CHANGED/);
});
