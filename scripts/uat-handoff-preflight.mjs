// Read-only, names-only report. Never serialize env values or connection errors.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {validateUatRoster} from '../server/operations-uat-workflow.mjs';
export const requiredUatNames=Object.freeze(['IWAY_AUTH_ENABLED','IWAY_AUTH_SCHEMA_APPROVED','IWAY_STAGING_VERCEL_PROJECT_ID','IWAY_AUTH_ORIGIN','IWAY_AUTH_APPROVED_ORIGIN','IWAY_AUTH_DATABASE_URL','IWAY_AUTH_PROVIDER','IWAY_SUPABASE_PUBLISHABLE_KEY','IWAY_SESSION_ENCRYPTION_KEY','IWAY_UAT_ENABLED','IWAY_UAT_SCHEMA_APPROVED','IWAY_UAT_DATABASE_URL']);
export function handoffPreflight({env={},manifest,previewNames=[]}={}){
 const blockers=[];
 try{validateUatRoster(manifest?.testers);}catch{blockers.push('VERIFIED_IDENTITY_AND_RELATIONSHIP_BINDINGS_REQUIRED');}
 if(!manifest?.controlPlaneNamespaceId)blockers.push('APPROVED_GOVERNANCE_NAMESPACE_REQUIRED');
 for(const entry of manifest?.testers??[])if(!entry.identityEvidence||!entry.permissionsApproved||entry.role==='driver'&&!entry.employmentEvidence)blockers.push('VERIFIED_PROVISIONING_EVIDENCE_REQUIRED');
 const missingLocal=requiredUatNames.filter(name=>typeof env[name]!=='string'||!env[name].trim());
 const missingPreview=requiredUatNames.filter(name=>!previewNames.includes(name));
 return {status:blockers.length||missingLocal.length||missingPreview.length?'BLOCKED':'REVIEW_REQUIRED',missingLocal,missingPreview,blockers:[...new Set(blockers)],runtimeLogin:{auth:env.IWAY_AUTH_DATABASE_URL?'NOT_RUN':'BLOCKED_MISSING_RESTRICTED_CREDENTIAL',broker:env.IWAY_UAT_DATABASE_URL?'NOT_RUN':'BLOCKED_MISSING_RESTRICTED_CREDENTIAL'},approval:'No deployment, provisioning, credentials, invitations or access changes authorized'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const manifest=JSON.parse(readFileSync(new URL('../docs/security/uat-provisioning-manifest.json',import.meta.url),'utf8'));
 const env={};if(process.argv[2])for(const line of readFileSync(process.argv[2],'utf8').split(/\r?\n/)){const match=/^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);if(match)env[match[1]]=match[2];}
 console.log(JSON.stringify(handoffPreflight({env,manifest}),null,2));
}
