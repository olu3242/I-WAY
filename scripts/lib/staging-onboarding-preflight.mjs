import {loadHostedUatBindings} from '../../server/operations-uat-hosted-bindings.mjs';
import {loadHostedUatVerifier} from '../../server/operations-uat-jwks.mjs';
const project='prj_7uof3CdmN1QvzKxETkXvHjlrLjVm';
// Read-only diagnostic. Never returns identities, credentials, keys or driver errors.
export async function assessStagingOnboarding({env,pool,engine,fetchImpl=fetch}={}){
 const checks=[];
 const report=()=>({status:checks.every(c=>c.status==='PASS')?'PASS_PREREQUISITES_ONLY':'BLOCKED',checks,hostedCertified:false,tenantWorkflow:'NOT_RUN'});
 if(env?.VERCEL_ENV!=='preview'||env.VERCEL_PROJECT_ID!==project||env.IWAY_STAGING_VERCEL_PROJECT_ID!==project){checks.push({check:'target',status:'BLOCKED'});return report();}
 for(const key of ['IWAY_AUTH_ENABLED','IWAY_UAT_ENABLED'])checks.push({check:key,status:env[key]==='true'?'PASS':'BLOCKED'});
 try{await loadHostedUatVerifier({fetchImpl});checks.push({check:'publicSigningKeys',status:'PASS'});}catch{checks.push({check:'publicSigningKeys',status:'BLOCKED'});}
 let bindings;
 try{bindings=await loadHostedUatBindings({pool});checks.push({check:'approvedBindings',status:'PASS'});}catch{checks.push({check:'approvedBindings',status:'BLOCKED'});}
 if(!bindings){checks.push({check:'activeTenantRelationships',status:'NOT_RUN'});return report();}
 try{
  if(!await engine.validatePlatformNamespace(bindings.platformNamespaceId))throw Error();
  for(const entry of bindings.roster)if(!await engine.verifyUatEntry(entry,bindings.platformNamespaceId))throw Error();
  checks.push({check:'activeTenantRelationships',status:'PASS'});
 }catch{checks.push({check:'activeTenantRelationships',status:'BLOCKED'});}
 return report();
}
