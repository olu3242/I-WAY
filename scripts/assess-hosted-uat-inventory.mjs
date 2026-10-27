// Metadata only. Never opens a connection, reads env values or changes hosting.
import {requiredUatNames,uatEnvironmentContract} from './uat-handoff-preflight.mjs';
export function assessHostedUatInventory({projectId,branch,envs=[],roles=[],schemas=[],identityCounts={}}={}){
 const blockers=[];
 if(projectId!==uatEnvironmentContract[0].project)blockers.push('ISOLATED_PROJECT_REQUIRED');
 if(typeof branch!=='string'||!branch.startsWith('work/'))blockers.push('IMPLEMENTATION_BRANCH_REQUIRED');
 const preview=envs.filter(entry=>Array.isArray(entry?.target)&&entry.target.includes('preview')&&(!entry.gitBranch||entry.gitBranch===branch));
 const configured=requiredUatNames.filter(name=>preview.some(entry=>entry.key===name));
 const missingPreview=requiredUatNames.filter(name=>!configured.includes(name));
 if(missingPreview.length)blockers.push('PREVIEW_CONFIGURATION_INCOMPLETE');
 const privilegedNames=['SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEY'].filter(name=>preview.some(entry=>entry.key===name));
 if(privilegedNames.length)blockers.push('PRIVILEGED_PROVIDER_CREDENTIAL_IN_APPLICATION_PROJECT');
 const requiredRoles=['iway_auth_runtime','iway_uat_runtime','iway_operations_runtime','iway_uat_management_runtime'];
 const runtimeRoles=requiredRoles.map(name=>{
  const role=roles.find(item=>item?.rolname===name);
  const status=!role?'MISSING':role.rolcanlogin!==true?'LOGIN_DISABLED':role.rolinherit!==false||role.rolsuper!==false||role.rolbypassrls!==false?'RESTRICTED_FLAGS_INVALID':'CATALOG_FLAGS_ONLY';
  if(status!=='CATALOG_FLAGS_ONLY')blockers.push('DATABASE_ROLE_NOT_READY');
  return {name,status};
 });
 const missingSchemas=['iway_private','iway_uat_private','operations_engine_private','iway_uat_management_private'].filter(name=>!schemas.includes(name));
 if(missingSchemas.length)blockers.push('REQUIRED_SCHEMAS_MISSING');
 const counts={};
 for(const name of ['authUsers','googleIdentities','verifiedMfaFactors']){
  const count=identityCounts[name];counts[name]=Number.isSafeInteger(count)&&count>=0?count:null;
 }
 if(counts.authUsers===null||counts.googleIdentities===null||counts.verifiedMfaFactors===null)blockers.push('IDENTITY_INVENTORY_UNKNOWN');
 else if(counts.authUsers<4||counts.googleIdentities<4||counts.verifiedMfaFactors<2)blockers.push('FOUR_PERSONA_IDENTITY_SETUP_INCOMPLETE');
 // Counts and role flags cannot prove roster identity, actual login, TLS, RLS,
 // permissions, callback configuration, delivery or end-to-end application use.
 return {status:blockers.length?'BLOCKED':'REQUIRES_RUNTIME_CERTIFICATION',configuredPreview:configured,missingPreview,privilegedNames,runtimeRoles,missingSchemas,identityCounts:counts,blockers:[...new Set(blockers)],hostedCertified:false,networkRequests:0};
}
