import test from 'node:test';import assert from 'node:assert/strict';
import {assessAuthStaging,authEnvNames,stagingProject,stagingTeam} from '../scripts/auth-staging-readiness.mjs';
const fixture=()=>({project:{id:stagingProject,accountId:stagingTeam,nodeVersion:'24.x',ssoProtection:{deploymentType:'all'}},envs:authEnvNames.map(key=>({key,target:['preview'],type:'encrypted'})),domains:[{name:'iway-auth-staging.vercel.app',projectId:stagingProject,verified:true}],deployments:[],manifest:{projectId:stagingProject,commit:'a'.repeat(40),clean:true},receipt:{commit:'a'.repeat(40),catalogReviewed:true,schemaApproved:true,restrictedRoleVerified:true,providerCallbackApproved:true,syntheticIdentitiesApproved:true,ciPassed:true,previewDeploymentAuthorized:true}});
test('B516 readiness requires every metadata and approved-evidence gate, never implies hosted certification',()=>{
 const base=fixture();assert.equal(assessAuthStaging(base).status,'READY_FOR_APPROVED_PREVIEW');assert.equal(assessAuthStaging(base).hostedTested,false);assert.equal(assessAuthStaging(base).rollbackCandidateVerified,false);
 for(const key of authEnvNames){const x=fixture();x.envs=x.envs.filter(e=>e.key!==key);assert.equal(assessAuthStaging(x).status,'BLOCKED');}
 for(const key of Object.keys(base.receipt).filter(k=>k!=='commit')){const x=fixture();x.receipt[key]=false;assert.equal(assessAuthStaging(x).status,'BLOCKED');}
 for(const mutate of [x=>x.project.id='public-site',x=>x.project.accountId='other',x=>x.project.ssoProtection=null,x=>x.manifest.clean=false,x=>x.receipt.commit='b'.repeat(40),x=>x.domains[0].verified=false,x=>x.envs[0].type='plain',x=>x.envs[1].target=['production']]){const x=fixture();mutate(x);assert.equal(assessAuthStaging(x).status,'BLOCKED');}
 assert.equal(assessAuthStaging().status,'BLOCKED');
});
