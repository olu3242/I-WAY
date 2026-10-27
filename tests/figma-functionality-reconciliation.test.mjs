import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildReconciliation,prototypeScreens} from '../scripts/reconcile-figma-functionality.mjs';
test('reconciliation covers every prototype root screen while distinguishing unsupported and newer workflows',()=>{
 const report=buildReconciliation();assert.equal(report.primaryScreenCount,35);assert.equal(new Set(report.screens.map(r=>r.id)).size,35);
 assert.equal(report.secondaryPrototypeControls.length,9);
 assert.equal(report.screens.find(r=>r.id==='carrier:settings').route,'/admin');
 for(const id of ['driver:chat','platform:payments'])assert.equal(report.screens.find(r=>r.id===id).status,'design-only');
 assert.equal(report.screens.find(r=>r.id==='platform:loads').status,'obsolete-in-design');
 assert.ok(report.preservedImplementationExtensions.some(r=>r.capability.includes('expense')));
 assert.deepEqual(report.conformity,{functionalityPercentage:null,visualPercentage:null,status:'NOT_CERTIFIED'});
 assert.ok(report.screens.every(r=>r.visual.status==='BLOCKED_REFERENCE'&&r.hosted.executed===0&&r.localEvidence.status==='NOT_RUN'));
});
test('screen discovery fails closed on missing declarations and keeps added screens visible for review',()=>{
 assert.throws(()=>prototypeScreens('export default function Demo(){}'),/DECLARATION_MISSING/);
 assert.deepEqual(prototypeScreens("type Screen = 'dashboard' | 'new-feature'\n"),['dashboard','new-feature']);
});
test('reconciliation artifact matches reviewed source mapping and hashes',()=>{
 assert.deepEqual(JSON.parse(readFileSync('docs/certification/harmonized-figma/matrix.json','utf8')),buildReconciliation());
});
