// Sanitized metadata-only readiness. Does not change environment, deploy, or connect to a database.
export const stagingProject='prj_7uof3CdmN1QvzKxETkXvHjlrLjVm';
export const stagingTeam='team_zNHlJbJHa4YZFwN4p9lcHzEH';
export const authEnvNames=Object.freeze(['IWAY_AUTH_DATABASE_URL','IWAY_SESSION_ENCRYPTION_KEY','IWAY_SUPABASE_PUBLISHABLE_KEY','IWAY_AUTH_PROVIDER','IWAY_AUTH_ENABLED','IWAY_AUTH_SCHEMA_APPROVED','IWAY_AUTH_ORIGIN','IWAY_AUTH_APPROVED_ORIGIN','IWAY_STAGING_VERCEL_PROJECT_ID']);
export function assessAuthStaging({project,envs,domains,deployments,manifest,receipt}={}){
 const blockers=[];
 const need=(ok,code)=>{if(!ok)blockers.push(code);};
 need(project?.id===stagingProject&&project?.accountId===stagingTeam,'PROJECT_IDENTITY');
 need(project?.nodeVersion==='24.x','NODE_RUNTIME');
 need(project?.ssoProtection?.deploymentType==='all','DEPLOYMENT_PROTECTION');
 for(const key of authEnvNames)need(Array.isArray(envs)&&envs.some(e=>e.key===key&&e.target?.includes('preview')), 'MISSING_'+key);
 for(const key of ['IWAY_AUTH_DATABASE_URL','IWAY_SESSION_ENCRYPTION_KEY'])need(envs?.some(e=>e.key===key&&['secret','encrypted','sensitive'].includes(e.type)&&e.target?.includes('preview')),'SECRET_STORAGE_'+key);
 need(domains?.some(d=>d.name==='iway-auth-staging.vercel.app'&&d.verified===true&&d.projectId===stagingProject),'VERIFIED_DOMAIN');
 need(manifest?.projectId===stagingProject&&/^[0-9a-f]{40}$/.test(manifest?.commit??'')&&manifest.clean===true,'CLEAN_SOURCE_MANIFEST');
 need(receipt?.commit===manifest?.commit&&/^[0-9a-f]{40}$/.test(receipt?.commit??''),'EVIDENCE_COMMIT');
 for(const field of ['catalogReviewed','schemaApproved','restrictedRoleVerified','providerCallbackApproved','syntheticIdentitiesApproved','ciPassed','previewDeploymentAuthorized'])need(receipt?.[field]===true,'MISSING_'+field);
 const deployment=deployments?.find(d=>d.uid===receipt?.deploymentId&&d.readyState==='READY'&&d.target!=='production'&&d.meta?.githubCommitSha===manifest?.commit);
 return {status:blockers.length?'BLOCKED':'READY_FOR_APPROVED_PREVIEW',blockers,hostedTested:false,
  rollbackCandidateVerified:!!deployment&&receipt?.rollbackVerified===true,production:'NO-GO'};
}
