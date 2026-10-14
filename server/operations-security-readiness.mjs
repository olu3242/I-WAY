import {postgresConfig,serverConfig} from './config.mjs';
export const secretInventory=Object.freeze([
 {name:'DATABASE_URL',scope:'server',purpose:'Restricted registration connection',rotationRequired:true},
 {name:'PGSSL',scope:'server',purpose:'Certificate-verifying TLS requirement',secret:false},
 {name:'IWAY_CONSENT_VERSION',scope:'server',purpose:'Separately approved consent version',secret:false},
 {name:'SUPABASE_SERVICE_ROLE_KEY',scope:'server-administration-only',applicationUse:'prohibited',rotationRequired:true},
 {name:'SUPABASE_DB_PASSWORD',scope:'server-administration-only',applicationUse:'prohibited',rotationRequired:true},
 {name:'NEXT_PUBLIC_SUPABASE_URL',scope:'public',secret:false},
 {name:'NEXT_PUBLIC_SUPABASE_ANON_KEY',scope:'public',secret:false}
]);
export function securityConfigurationReport(env){
 if(!env||typeof env!=='object')throw Error('CONFIG_INPUT');
 const inventory=secretInventory.map(item=>({...item,present:typeof env[item.name]==='string'&&env[item.name].length>0,...(item.rotationRequired?{rotationVerified:false}:{})}));
 let database='BLOCKED',productionValidation='BLOCKED';
 try{if(postgresConfig(env))database='PASS'}catch{/* Values and raw errors are never part of the report. */}
 try{const config=serverConfig({...env,NODE_ENV:'production'});if(config.postgres)productionValidation='PASS'}catch{}
 return {inventory,databaseFormatAndTLS:database,productionConfiguration:productionValidation,credentialAuthentication:'UNVERIFIED',credentialRotation:'UNVERIFIED',legalConsentApproval:'UNVERIFIED',hostedDecision:'NO-GO'};
}
export function classifySecurityEvent({status,code}={}){
 if(status===401)return {category:'authentication',action:'Review session expiry, activation and verifier health.'};
 if(status===403)return {category:'authorization',action:'Review current tenant, relationship and explicit permissions.'};
 if(['SIGNATURE','REPLAY','PROVENANCE'].some(prefix=>typeof code==='string'&&code.includes(prefix)))return {category:'integration_integrity',action:'Quarantine the local event and inspect approved provider configuration.'};
 if(status>=500)return {category:'availability',action:'Inspect sanitized health signals; preserve audit and recovery evidence.'};
 return {category:'validation',action:'Review the bounded input contract without copying request values into logs.'};
}
