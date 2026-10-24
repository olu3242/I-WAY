import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {approvalIds,parsePendingApprovalDocument,buildUnexecutedHostedResults} from '../scripts/check-uat-approvals.mjs';
const source=readFileSync(new URL('../docs/security/b761-b780-approval-matrix.md',import.meta.url),'utf8').replaceAll('\r\n','\n');
const parsed=()=>parsePendingApprovalDocument(source);
const cases=()=>Array.from({length:84},(_,i)=>({case:'HOST-'+String(i+1).padStart(3,'0'),tester:'synthetic@illustrative.invalid',persona:'driver',method:'google',scenario:'synthetic-fixture',route_or_control:'/uat/login',prerequisites:'Approved identity and access',steps:'Use approved synthetic fixture',expected:'Authorization enforced'}));
test('tracked owner matrix preserves all twelve identifiers, exact target and complete dependency order',()=>{
 const r=parsed();assert.deepEqual(r.actions.map(a=>a.id),approvalIds);assert.equal(r.approvedOwnerActions,0);assert.equal(r.hostedMutationsAllowed,false);
 assert.deepEqual(r.actions.filter(a=>!a.required).map(a=>a.id),['A01','A02','A12']);
 assert.match(r.actions[9].target,/prj_7uof3CdmN1QvzKxETkXvHjlrLjVm/);
 for(const a of r.actions)for(const dependency of a.dependsOn)assert.ok(r.dependencyOrder.indexOf(dependency)<r.dependencyOrder.indexOf(a.id));
});
test('approval source digest binds canonical content and survives Windows line endings',()=>{
 assert.equal(parsed().sourceSha256LF,parsePendingApprovalDocument(source.replaceAll('\n','\r\n')).sourceSha256LF);
 assert.notEqual(parsed().sourceSha256LF,parsePendingApprovalDocument(source.replace('Optional publication','Owner-reviewed publication')).sourceSha256LF);
});
test('missing, duplicate or unknown owner action identifiers are rejected',()=>{
 for(const document of [source.replace('## A12 —','## Other —'),source.replace('## A12 —','## A01 —'),source.replace('## A12 —','## A13 —')])assert.throws(()=>parsePendingApprovalDocument(document),/APPROVAL_/);
});
test('ambiguous fields, missing rollback and changed owner decisions cannot silently authorize work',()=>{
 for(const document of [source.replace('**Exact target:** olu3242','**Exact target:** duplicate\n\n**Exact target:** olu3242'),source.replace('**Rollback:** Stop any unexpected build','**Missing rollback:** Stop any unexpected build'),source.replace('BLOCKED_APPROVAL_REQUIRED','APPROVED'),source.replace('[TBC].','Approved by generic task request.')])assert.throws(()=>parsePendingApprovalDocument(document),/APPROVAL_|OWNER_APPROVAL_/);
});
test('dependency cycles between role provisioning and migrations are rejected',()=>{
 const document=source.replace('**Dependencies:** None\n\n**Prerequisites:** Owner attests','**Dependencies:** A05\n\n**Prerequisites:** Owner attests');
 assert.throws(()=>parsePendingApprovalDocument(document),/APPROVAL_DEPENDENCY_CYCLE/);
});
test('unknown, self-referential and repeated dependencies cannot produce a valid execution order',()=>{
 for(const dependencies of ['A99','A01','A03, A03'])assert.throws(()=>parsePendingApprovalDocument(source.replace('**Dependencies:** None','**Dependencies:** '+dependencies)),/APPROVAL_DEPENDENC/);
});
test('new hosted run never promotes synthetic, local or historical PASS claims and discards unrelated payloads',()=>{
 const scenarios=cases().map(c=>({...c,requiredIdentityBindings:['Canonical Auth UUID','Active employment'],status:'PASS',executed:true,localResult:'PASS',accessToken:'synthetic-must-not-copy'}));
 const r=buildUnexecutedHostedResults({scenarios,register:parsed(),blockers:['MISSING_APPROVED_HOSTED_ACCESS']});
 assert.deepEqual(r.counts,{PASS:0,FAIL:0,BLOCKED:84,'NOT RUN':0});assert.equal(r.hostedExecuted,0);assert.ok(r.results.every(c=>c.status==='BLOCKED'&&!c.executed&&c.sanitized_evidence===''));
 assert.ok(!JSON.stringify(r).includes('synthetic-must-not-copy'));
 assert.deepEqual(r.results[0].requiredIdentityBindings,['Canonical Auth UUID','Active employment']);
});
test('hosted results reject missing/duplicate cases and tampered authority registers',()=>{
 const base={register:parsed(),blockers:['BLOCKED']};
 for(const scenarios of [cases().slice(1),cases().map((c,i)=>i===1?{...c,case:'HOST-001'}:c),cases().map((c,i)=>i===1?{...c,case:'HOST-999'}:c)])assert.throws(()=>buildUnexecutedHostedResults({...base,scenarios}),/HOSTED_CASE_IDS_INVALID/);
 assert.throws(()=>buildUnexecutedHostedResults({...base,scenarios:cases(),register:{...parsed(),hostedMutationsAllowed:true}}),/APPROVAL_REGISTER_INVALID/);
});
test('unexecuted hosted preparation requires actual blockers and known action references',()=>{
 assert.throws(()=>buildUnexecutedHostedResults({scenarios:cases(),register:parsed(),blockers:[]}),/HOSTED_BLOCKERS_REQUIRED/);
 assert.throws(()=>buildUnexecutedHostedResults({scenarios:cases().map(c=>({...c,requiredApprovals:['A99']})),register:parsed(),blockers:['BLOCKED']}),/HOSTED_CASE_APPROVAL_INVALID/);
 assert.throws(()=>buildUnexecutedHostedResults({scenarios:cases().map(c=>({...c,requiredIdentityBindings:[null]})),register:parsed(),blockers:['BLOCKED']}),/HOSTED_IDENTITY_REQUIREMENTS_INVALID/);
});
