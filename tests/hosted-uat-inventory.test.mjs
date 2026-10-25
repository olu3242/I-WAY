import test from 'node:test';
import assert from 'node:assert/strict';
import {assessHostedUatInventory} from '../scripts/assess-hosted-uat-inventory.mjs';
import {requiredUatNames,uatEnvironmentContract} from '../scripts/uat-handoff-preflight.mjs';
const base=()=>({projectId:uatEnvironmentContract[0].project,branch:'work/fixture',envs:requiredUatNames.map(key=>({key,target:['preview'],value:'synthetic-must-not-escape'})),roles:['iway_auth_runtime','iway_uat_runtime','iway_operations_runtime','iway_uat_management_runtime'].map(rolname=>({rolname,rolcanlogin:true,rolinherit:false,rolsuper:false,rolbypassrls:false})),schemas:['iway_private','iway_uat_private','operations_engine_private','iway_uat_management_private'],identityCounts:{authUsers:4,googleIdentities:4,verifiedMfaFactors:2}});
test('complete metadata requires runtime certification and never serializes secret values',()=>{
 const result=assessHostedUatInventory(base());assert.equal(result.status,'REQUIRES_RUNTIME_CERTIFICATION');assert.equal(result.hostedCertified,false);assert.equal(result.networkRequests,0);assert.ok(!JSON.stringify(result).includes('synthetic-must-not-escape'));
});
test('production and other-branch variables cannot satisfy the Preview contract',()=>{
 const input=base();input.envs[0].target=['production'];input.envs[1].gitBranch='work/different';
 const result=assessHostedUatInventory(input);assert.equal(result.status,'BLOCKED');assert.deepEqual(result.missingPreview,requiredUatNames.slice(0,2));
});
test('disabled logins, missing schemas, privileged provider keys and absent identities block',()=>{
 const input=base();input.roles[1].rolcanlogin=false;input.roles.pop();input.schemas=[];input.identityCounts={authUsers:0,googleIdentities:0,verifiedMfaFactors:0};input.envs.push({key:'SUPABASE_SERVICE_ROLE_KEY',target:['preview'],value:'synthetic-secret'});
 const result=assessHostedUatInventory(input);assert.equal(result.runtimeRoles[1].status,'LOGIN_DISABLED');assert.equal(result.runtimeRoles[3].status,'MISSING');
 for(const code of ['DATABASE_ROLE_NOT_READY','REQUIRED_SCHEMAS_MISSING','FOUR_PERSONA_IDENTITY_SETUP_INCOMPLETE','PRIVILEGED_PROVIDER_CREDENTIAL_IN_APPLICATION_PROJECT'])assert.ok(result.blockers.includes(code));assert.ok(!JSON.stringify(result).includes('synthetic-secret'));
});
test('wrong target and unknown or malformed catalog facts cannot produce readiness',()=>{
 const input=base();input.projectId='public-project';input.identityCounts.authUsers='4';input.roles[0].rolbypassrls=true;
 const result=assessHostedUatInventory(input);assert.equal(result.status,'BLOCKED');assert.ok(result.blockers.includes('ISOLATED_PROJECT_REQUIRED'));assert.ok(result.blockers.includes('IDENTITY_INVENTORY_UNKNOWN'));assert.equal(result.runtimeRoles[0].status,'RESTRICTED_FLAGS_INVALID');
});
