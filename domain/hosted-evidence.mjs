import {createHash,createPublicKey,verify} from 'node:crypto';
import {hostedScenarios,hostedPrerequisites} from './operations-release.mjs';
import {remediationBatches} from './remediation-wave.mjs';

const fail=code=>{throw Error(code)};
export const digest=value=>createHash('sha256').update(value).digest('hex');
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const id=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(x);
const date=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x;
export function exact(value,keys){
 if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).sort().join('|')!==[...keys].sort().join('|'))fail('SCHEMA_INVALID');
}
export function canonical(value){
 if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);
 if(typeof value==='number'&&Number.isSafeInteger(value))return String(value);
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&Object.getPrototypeOf(value)===Object.prototype)return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 fail('CANONICAL_VALUE_INVALID');
}
export function boundedJSON(raw){
 if(!Buffer.isBuffer(raw)||raw.length>262144)fail('ARTIFACT_SIZE_INVALID');
 const text=raw.toString('utf8');
 if(!Buffer.from(text).equals(raw)||/postgres(?:ql)?:\/\/|-----BEGIN .*PRIVATE KEY|\bBearer\s+\S+|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(text))fail('SENSITIVE_ARTIFACT');
 let value;try{value=JSON.parse(text)}catch{fail('ARTIFACT_JSON_INVALID')}
 let nodes=0;
 function visit(v,depth){
  if(depth>12||++nodes>10000)fail('ARTIFACT_COMPLEXITY');
  if(v&&typeof v==='object')for(const [k,x]of Object.entries(v)){
   if(/^(?:__proto__|constructor|prototype)$|password|secret|access.?token|refresh.?token|private.?key|connection.?string|database.?url|api.?key|ssn|bank.?account/i.test(k))fail('SENSITIVE_ARTIFACT');visit(x,depth+1);
  }else if(typeof v==='string'&&v.length>4096)fail('ARTIFACT_STRING_BOUND');
 }
 visit(value,0);canonical(value);return value;
}
export const recordKeys=['schemaVersion','id','batch','scenario','tenant','environment','sourceHash','gitSha','artifact','collector','collectedAt','method','result','assertions','authorizationRef','expiresAt','provenance'];
export function validateRecord(record,binding,now){
 exact(record,recordKeys);exact(record.artifact,['path','sha256']);exact(record.provenance,['scope','runId']);
 if(record.schemaVersion!==1||!id(record.id)||!id(record.tenant)||!id(record.collector)||!id(record.authorizationRef)||!id(record.provenance.runId))fail('RECORD_ID_INVALID');
 if(!Object.hasOwn(remediationBatches,record.batch)&&record.batch!=='B256')fail('BATCH_INVALID');
 if(!['staging','isolated-hosted'].includes(record.environment)||!['local-fixture','independent-hosted'].includes(record.provenance.scope)||!['fixture-runner','approved-hosted-runner'].includes(record.method)||!['PASS','FAIL'].includes(record.result))fail('RECORD_SCOPE_INVALID');
 if((record.provenance.scope==='independent-hosted')!==(record.method==='approved-hosted-runner'))fail('RECORD_SCOPE_INVALID');
 if(!hex(record.sourceHash)||!/^[a-f0-9]{40}$/.test(record.gitSha)||!hex(record.artifact.sha256))fail('RECORD_HASH_INVALID');
 if(record.tenant!==binding.tenant||record.environment!==binding.environment||record.sourceHash!==binding.sourceHash||record.gitSha!==binding.gitSha)fail('EVIDENCE_BINDING_MISMATCH');
 if(!date(now)||!date(record.collectedAt)||!date(record.expiresAt)||record.collectedAt>now||record.expiresAt<=record.collectedAt||record.expiresAt<=now)fail('EVIDENCE_EXPIRED');
 if(typeof record.artifact.path!=='string'||!/^artifacts\/[a-f0-9]{64}\.json$/.test(record.artifact.path)||record.artifact.path!==`artifacts/${record.artifact.sha256}.json`)fail('ARTIFACT_PATH_INVALID');
 const scenario=hostedScenarios.find(s=>s.id===record.scenario);
 if(record.scenario!==null&&!scenario||remediationBatches[record.batch]?.scenario&&record.scenario!==remediationBatches[record.batch].scenario)fail('SCENARIO_INVALID');
 exact(record.assertions,scenario?.checks??[]);
 if(Object.values(record.assertions).some(x=>typeof x!=='boolean')||record.result==='PASS'&&Object.values(record.assertions).some(x=>!x))fail('ASSERTIONS_INVALID');
 return digest(canonical(record));
}
export function validateArtifact(record,raw){
 if(digest(raw)!==record.artifact.sha256)fail('ARTIFACT_TAMPERED');
 const artifact=boundedJSON(raw);
 exact(artifact,['schemaVersion','runId','scenario','tenant','environment','sourceHash','gitSha','scope','result','assertions']);
 const expected={schemaVersion:1,runId:record.provenance.runId,scenario:record.scenario,tenant:record.tenant,environment:record.environment,sourceHash:record.sourceHash,gitSha:record.gitSha,scope:record.provenance.scope,result:record.result,assertions:record.assertions};
 if(canonical(artifact)!==canonical(expected))fail('ARTIFACT_BINDING_MISMATCH');
 return artifact;
}
// policy is installed by the trusted application, never taken from submitted evidence.
export function verifyEnvelope(envelope,policy,{purpose,tenant,environment,at}){
 exact(envelope,['keyId','payload','signature']);
 if(!id(envelope.keyId)||typeof envelope.signature!=='string'||!/^[A-Za-z0-9+/]{86}==$/.test(envelope.signature))fail('SIGNATURE_INVALID');
 const key=policy?.keys?.[envelope.keyId];
 if(!key||key.revoked===true||!key.purposes?.includes(purpose)||!key.tenants?.includes(tenant)||!key.environments?.includes(environment)||!date(at)||!date(key.notBefore)||!date(key.expiresAt)||at<key.notBefore||at>=key.expiresAt)fail('UNTRUSTED_SIGNER');
 let ok=false;try{const publicKey=createPublicKey(key.publicKey);ok=publicKey.asymmetricKeyType==='ed25519'&&verify(null,Buffer.from(canonical(envelope.payload)),publicKey,Buffer.from(envelope.signature,'base64'))}catch{}
 if(!ok)fail('SIGNATURE_INVALID');return key;
}
export function verifyAuthorization(envelope,policy,binding,now){
 const grant=envelope?.payload;
 exact(grant,['schemaVersion','id','tenant','environment','sourceHash','gitSha','scenarios','prerequisites','notBefore','expiresAt','syntheticOnly','noRealDelivery']);
 if(grant.schemaVersion!==1||!id(grant.id)||policy?.revokedAuthorizations?.includes(grant.id)||grant.tenant!==binding.tenant||grant.environment!==binding.environment||grant.sourceHash!==binding.sourceHash||grant.gitSha!==binding.gitSha||!['staging','isolated-hosted'].includes(grant.environment)||!date(grant.notBefore)||!date(grant.expiresAt)||!date(now)||grant.notBefore>now||grant.expiresAt<=now||grant.syntheticOnly!==true||grant.noRealDelivery!==true)fail('AUTHORIZATION_INVALID');
 if(!Array.isArray(grant.scenarios)||grant.scenarios.length===0||new Set(grant.scenarios).size!==grant.scenarios.length||grant.scenarios.some(x=>!hostedScenarios.some(s=>s.id===x)))fail('AUTHORIZATION_SCOPE_INVALID');
 exact(grant.prerequisites,hostedPrerequisites);
 // Each prerequisite is independently signed, scope-bound, revocable evidence, not a boolean.
 for(const name of hostedPrerequisites){
  const attestation=grant.prerequisites[name],p=attestation?.payload;
  exact(p,['id','prerequisite','tenant','environment','sourceHash','gitSha','evidenceSha256','approvedAt','expiresAt']);
  if(p.prerequisite!==name||!id(p.id)||!hex(p.evidenceSha256)||p.tenant!==binding.tenant||p.environment!==binding.environment||p.sourceHash!==binding.sourceHash||p.gitSha!==binding.gitSha||!date(p.approvedAt)||!date(p.expiresAt)||p.approvedAt>now||p.expiresAt<=now||policy?.revokedAttestations?.includes(p.id))fail('PREREQUISITE_INVALID');
  verifyEnvelope(attestation,policy,{purpose:'approve:'+name,tenant:binding.tenant,environment:binding.environment,at:now});
  if(typeof policy.readAttestation!=='function')fail('PREREQUISITE_ARTIFACT_REQUIRED');
  const bytes=policy.readAttestation(p.evidenceSha256);
  if(digest(bytes)!==p.evidenceSha256)fail('PREREQUISITE_ARTIFACT_TAMPERED');
  boundedJSON(bytes);
 }
 verifyEnvelope(envelope,policy,{purpose:'authorize',tenant:binding.tenant,environment:binding.environment,at:now});return grant;
}
export const lifecycle=Object.freeze({DRAFT:['SUBMITTED','REJECTED','REVOKED','EXPIRED'],SUBMITTED:['VALIDATED','REJECTED','REVOKED','EXPIRED'],VALIDATED:['REVIEWED','REJECTED','REVOKED','EXPIRED'],REVIEWED:['ACCEPTED','REJECTED','REVOKED','EXPIRED'],ACCEPTED:['REVOKED','EXPIRED','SUPERSEDED']});
export function emptyHostedIntakeAssessment(sourceHash){
 if(!hex(sourceHash))fail('SOURCE_HASH_REQUIRED');
 return {schemaVersion:1,sourceHash,scope:'independent-hosted-evidence-intake',records:0,accepted:0,authorization:'MISSING',hostedExecuted:false,hostedDecision:'NO-GO',productionDecision:'NO-GO',scenarios:hostedScenarios.map(s=>({id:s.id,status:'NOT_EXECUTED'}))};
}
