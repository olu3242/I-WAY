// Read-only, names-only report. Never serialize env values or connection errors.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {validateUatRoster} from '../server/operations-uat-workflow.mjs';
import {resolveAuthRuntimeConfig} from '../server/operations-auth-runtime.mjs';
import {resolveUatRuntimeConfig} from '../server/operations-uat-runtime.mjs';
import {resolveHostedOperationsConfig} from '../server/operations-uat-hosted-runtime.mjs';
import {createConfiguredSessionCipher} from '../server/operations-supabase-session-config.experimental.mjs';
export const requiredUatNames=Object.freeze(['IWAY_AUTH_ENABLED','IWAY_AUTH_SCHEMA_APPROVED','IWAY_STAGING_VERCEL_PROJECT_ID','IWAY_AUTH_ORIGIN','IWAY_AUTH_APPROVED_ORIGIN','IWAY_AUTH_DATABASE_URL','IWAY_AUTH_PROVIDER','IWAY_SUPABASE_PUBLISHABLE_KEY','IWAY_SESSION_ENCRYPTION_KEY','IWAY_UAT_ENABLED','IWAY_UAT_SCHEMA_APPROVED','IWAY_UAT_DATABASE_URL','IWAY_OPERATIONS_DATABASE_URL']);
export const uatEnvironmentContract=Object.freeze([
 ['IWAY_AUTH_ENABLED','Authentication activation','Exact true; owner approval required'],
 ['IWAY_AUTH_SCHEMA_APPROVED','Reviewed auth schema','Exact b512-v4'],
 ['IWAY_STAGING_VERCEL_PROJECT_ID','Isolated project pin','Exact staging project; match genuine VERCEL_PROJECT_ID'],
 ['IWAY_AUTH_ORIGIN','Application callback and cookie origin','Exact HTTPS origin; no credentials, path, query or fragment'],
 ['IWAY_AUTH_APPROVED_ORIGIN','Owner-approved callback origin','Exact match to IWAY_AUTH_ORIGIN'],
 ['IWAY_AUTH_DATABASE_URL','Auth persistence','Pinned PostgreSQL project/database; iway_auth_runtime LOGIN; verified TLS; session port 5432'],
 ['IWAY_AUTH_PROVIDER','OAuth provider','Exact google'],
 ['IWAY_SUPABASE_PUBLISHABLE_KEY','Public Auth API credential','Publishable key or pinned-project anon compatibility key; never service-role/secret key'],
 ['IWAY_SESSION_ENCRYPTION_KEY','Server-side token encryption','Canonical 43-character base64url 32-byte key; server only'],
 ['IWAY_UAT_ENABLED','UAT broker activation','Exact true; owner approval required'],
 ['IWAY_UAT_SCHEMA_APPROVED','Reviewed broker schema','Exact b574-candidate-v1'],
 ['IWAY_UAT_DATABASE_URL','Broker persistence','Pinned PostgreSQL project/database; iway_uat_runtime LOGIN; verified TLS; session port 5432'],
 ['IWAY_OPERATIONS_DATABASE_URL','Operations persistence','Pinned PostgreSQL project/database; iway_operations_runtime LOGIN; verified TLS; explicit port 5432; password at least 12 characters']
].map(([name,purpose,validation])=>Object.freeze({name,purpose,validation,project:'prj_7uof3CdmN1QvzKxETkXvHjlrLjVm',scope:'preview',publicProjectAllowed:false})));
// Pure, offline validation. Only fixed codes and variable names leave this boundary.
// Runtime resolvers remain authoritative; this never opens a pool or contacts a provider.
export function databaseConnectionDiagnostics(env={}){
 const project='vnoxdinldneeczxibicp';
 return ['AUTH','UAT','OPERATIONS'].map(kind=>{
  const name='IWAY_'+kind+'_DATABASE_URL',role='iway_'+kind.toLowerCase()+'_runtime',value=env[name];
  const issues=[];
  if(typeof value!=='string'||!value.trim())issues.push('MISSING_CONNECTION_STRING');
  else{
   try{
    const url=new URL(value);
    if(['https:','http:'].includes(url.protocol))issues.push('API_URL_INSTEAD_OF_POSTGRES_CONNECTION');
    else if(!['postgres:','postgresql:'].includes(url.protocol))issues.push('POSTGRES_PROTOCOL_REQUIRED');
    else{
     const direct=url.hostname==='db.'+project+'.supabase.co';
     const pooler=/^aws-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname);
     if(!direct&&!pooler)issues.push('PINNED_DATABASE_HOST_REQUIRED');
     if(decodeURIComponent(url.username)!==(direct?role:role+'.'+project))issues.push('RESTRICTED_ROLE_REQUIRED');
     if(!url.password)issues.push('ROLE_PASSWORD_REQUIRED');
     else if(kind==='OPERATIONS'&&decodeURIComponent(url.password).length<12)issues.push('OPERATIONS_PASSWORD_TOO_SHORT');
     if(url.port!=='5432'&&(kind==='OPERATIONS'||url.port!==''))issues.push('SESSION_PORT_5432_REQUIRED');
     if(url.pathname!=='/postgres')issues.push('POSTGRES_DATABASE_REQUIRED');
     if(url.search||url.hash)issues.push('QUERY_AND_FRAGMENT_NOT_ALLOWED');
    }
   }catch{issues.push('MALFORMED_CONNECTION_STRING');}
  }
  return {name,expectedRole:role,issues,status:issues.length?'BLOCKED':'FORMAT_VALID_ONLY'};
 });
}
export function validateUatEnvironment(env={}){
 const databaseConnections=databaseConnectionDiagnostics(env);
 const missing=requiredUatNames.filter(name=>typeof env[name]!=='string'||!env[name].trim()),issues=[];
 const check=(code,fn)=>{try{if(fn()===false)throw Error();}catch{issues.push(code);}};
 check('AUTH_RUNTIME_CONTRACT_INVALID',()=>resolveAuthRuntimeConfig(env));
 check('BROKER_RUNTIME_CONTRACT_INVALID',()=>resolveUatRuntimeConfig(env));
 check('OPERATIONS_RUNTIME_CONTRACT_INVALID',()=>resolveHostedOperationsConfig(env));
 check('SESSION_ENCRYPTION_KEY_INVALID',()=>createConfiguredSessionCipher(env));
 check('PUBLISHABLE_API_KEY_INVALID',()=>{
  const key=env.IWAY_SUPABASE_PUBLISHABLE_KEY;
  if(typeof key!=='string'||/[\s]/.test(key))return false;
  if(/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(key))return true;
  if(!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key))return false;
  const claims=JSON.parse(Buffer.from(key.split('.')[1],'base64url'));
  return claims.role==='anon'&&claims.ref==='vnoxdinldneeczxibicp';
 });
 return {status:missing.length||issues.length?'BLOCKED':'PASS_OFFLINE_CONFIGURATION_ONLY',missing,issues,databaseConnections,networkRequests:0,hostedCertified:false};
}
export function handoffPreflight({env={},manifest,previewNames=[]}={}){
 const blockers=[];
 const configured=name=>typeof env[name]==='string'&&!!env[name].trim();
 try{validateUatRoster(manifest?.testers);}catch{blockers.push('VERIFIED_IDENTITY_AND_RELATIONSHIP_BINDINGS_REQUIRED');}
 if(!manifest?.controlPlaneNamespaceId)blockers.push('APPROVED_GOVERNANCE_NAMESPACE_REQUIRED');
 for(const entry of manifest?.testers??[])if(!entry.identityEvidence||!entry.permissionsApproved||entry.role==='driver'&&!entry.employmentEvidence)blockers.push('VERIFIED_PROVISIONING_EVIDENCE_REQUIRED');
 const missingLocal=requiredUatNames.filter(name=>!configured(name));
 const missingPreview=requiredUatNames.filter(name=>!previewNames.includes(name));
 const configuration=validateUatEnvironment(env);if(configuration.status==='BLOCKED')blockers.push('ENVIRONMENT_VALUES_INVALID');
 return {status:blockers.length||missingLocal.length||missingPreview.length?'BLOCKED':'REVIEW_REQUIRED',missingLocal,missingPreview,configuration,blockers:[...new Set(blockers)],runtimeLogin:{auth:configured('IWAY_AUTH_DATABASE_URL')?'NOT_RUN':'BLOCKED_MISSING_RESTRICTED_CREDENTIAL',broker:configured('IWAY_UAT_DATABASE_URL')?'NOT_RUN':'BLOCKED_MISSING_RESTRICTED_CREDENTIAL',operations:configured('IWAY_OPERATIONS_DATABASE_URL')?'NOT_RUN':'BLOCKED_MISSING_RESTRICTED_CREDENTIAL'},approval:'No deployment, provisioning, credentials, invitations or access changes authorized'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const manifest=JSON.parse(readFileSync(new URL('../docs/security/uat-provisioning-manifest.json',import.meta.url),'utf8'));
 const env={};if(process.argv[2])for(const line of readFileSync(process.argv[2],'utf8').split(/\r?\n/)){const match=/^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);if(match)env[match[1]]=match[2];}
 console.log(JSON.stringify(handoffPreflight({env,manifest}),null,2));
}
