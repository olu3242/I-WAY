import {hostedScenarios} from './operations-release.mjs';
import {exact,verifyAuthorization,verifyEnvelope,digest,canonical} from './hosted-evidence.mjs';

// Fixed observations; adapters return facts, not a caller-provided PASS verdict.
export const observationContracts=Object.freeze({
 identity:['assurance','serverTenant','revokedHttpStatus'],
 registration:['databaseRoleRestricted','consentVersion','approvedConsentVersion','receiptId','readbackReceiptId'],
 persistence:['committedId','connectionBefore','connectionAfter','readbackId'],
 isolation:['ownTenant','foreignReadCount','foreignWriteStatus','foreignDigestBefore','foreignDigestAfter'],
 workflow:['claimId','renewedClaimId','leaseBefore','leaseAfter','recoveredClaimId','staleCompletionStatus','completionCount'],
 integrations:['signatureValid','firstReceiptId','duplicateReceiptId','attempts','maximumAttempts','deadLetterCount','realDeliveryCount'],
 rollback:['artifactDigest','trustedArtifactDigest','backupDigest','restoredDigest','healthStatus','auditBefore','auditAfter']
});
const nonempty=x=>typeof x==='string'&&/^[A-Za-z0-9_.-]{1,100}$/.test(x);
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export function evaluateObservation(id,o,binding){
 const keys=observationContracts[id];if(!keys)throw Error('SCENARIO_UNKNOWN');exact(o,keys);
 switch(id){
 case 'identity':return {verifiedMfa:o.assurance==='aal2',tenantBound:o.serverTenant===binding.tenant,revokedSessionDenied:o.revokedHttpStatus===401};
 case 'registration':return {restrictedIdentity:o.databaseRoleRestricted===true,approvedConsent:nonempty(o.approvedConsentVersion)&&o.consentVersion===o.approvedConsentVersion,receiptPersisted:nonempty(o.receiptId)&&o.receiptId===o.readbackReceiptId};
 case 'persistence':return {commitPersisted:nonempty(o.committedId),restartReadMatched:nonempty(o.connectionBefore)&&nonempty(o.connectionAfter)&&o.connectionBefore!==o.connectionAfter&&o.committedId===o.readbackId};
 case 'isolation':return {ownReadAllowed:o.ownTenant===binding.tenant,foreignReadDenied:o.foreignReadCount===0,foreignWriteDenied:o.foreignWriteStatus===403,noForeignMutation:hash(o.foreignDigestBefore)&&o.foreignDigestBefore===o.foreignDigestAfter};
 case 'workflow':return {heartbeatPersisted:nonempty(o.claimId)&&o.claimId===o.renewedClaimId&&Number.isSafeInteger(o.leaseBefore)&&Number.isSafeInteger(o.leaseAfter)&&o.leaseAfter>o.leaseBefore,restartRecovered:nonempty(o.recoveredClaimId)&&o.recoveredClaimId!==o.claimId,staleFenceDenied:o.staleCompletionStatus===409,exactlyOneCompletion:o.completionCount===1};
 case 'integrations':return {signatureVerified:o.signatureValid===true,duplicateSuppressed:nonempty(o.firstReceiptId)&&o.firstReceiptId===o.duplicateReceiptId,retryBounded:Number.isSafeInteger(o.attempts)&&Number.isSafeInteger(o.maximumAttempts)&&o.attempts>0&&o.maximumAttempts>0&&o.maximumAttempts<=10&&o.attempts<=o.maximumAttempts,deadLetterVisible:o.deadLetterCount===1&&o.realDeliveryCount===0};
 case 'rollback':return {artifactVerified:hash(o.artifactDigest)&&o.artifactDigest===o.trustedArtifactDigest,restoreIntegrity:hash(o.backupDigest)&&o.backupDigest===o.restoredDigest,healthPassed:o.healthStatus===200,auditContinuity:hash(o.auditBefore)&&o.auditBefore===o.auditAfter};
 }
}
const transports=new WeakMap();
// Called only by a reviewed server composition root. CLI never loads adapter code or URLs.
export function installHostedTransport({binding,operations}){
 if(!binding||!['staging','isolated-hosted'].includes(binding.environment)||!operations||hostedScenarios.some(s=>typeof operations[s.id]!=='function'))throw Error('TRANSPORT_INVALID');
 const handle=Object.freeze({});transports.set(handle,{binding:{...binding},operations:{...operations}});return handle;
}
export async function runHostedScenario({id,binding,authorization,policy,transport,now=()=>new Date().toISOString()}){
 const grant=verifyAuthorization(authorization,policy,binding,now());
 if(!grant.scenarios.includes(id))throw Error('SCENARIO_NOT_AUTHORIZED');
 const installed=transports.get(transport);
 if(!installed||Object.keys(binding).some(k=>installed.binding[k]!==binding[k]))throw Error('TRUSTED_TRANSPORT_NOT_INSTALLED');
 const controller=new AbortController();
 let timer;
 try{
  const output=await Promise.race([installed.operations[id]({binding:Object.freeze({...binding}),syntheticOnly:true,noRealDelivery:true,signal:controller.signal}),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('SCENARIO_TIMEOUT'))},30000)})]);
  // Re-check expiry and revocation after any asynchronous external operation.
  verifyAuthorization(authorization,policy,binding,now());
  exact(output,['observation','attestation']);
  const {observation,attestation}=output,p=attestation?.payload;
  exact(p,['scenario','tenant','environment','sourceHash','gitSha','authorizationRef','observedAt','observationSha256','scope']);
  if(p.scenario!==id||p.tenant!==binding.tenant||p.environment!==binding.environment||p.sourceHash!==binding.sourceHash||p.gitSha!==binding.gitSha||p.authorizationRef!==grant.id||p.scope!=='hosted'||p.observationSha256!==digest(canonical(observation))||!Number.isFinite(Date.parse(p.observedAt))||p.observedAt>now()||Date.parse(now())-Date.parse(p.observedAt)>300000)throw Error('EXECUTION_ATTESTATION_INVALID');
  verifyEnvelope(attestation,policy,{purpose:'execute:'+id,tenant:binding.tenant,environment:binding.environment,at:now()});
  const checks=evaluateObservation(id,observation,binding);
  return {scenario:id,scope:'hosted',status:Object.values(checks).every(Boolean)?'PASS':'FAIL',checks,hostedExecuted:true};
 }finally{clearTimeout(timer);controller.abort()}
}
export async function runLocalHarness({id,binding,operation}){
 if(typeof operation!=='function')throw Error('LOCAL_ADAPTER_REQUIRED');
 const checks=evaluateObservation(id,await operation(),binding);
 return {scenario:id,scope:'local-fixture',status:Object.values(checks).every(Boolean)?'PASS':'FAIL',checks,hostedExecuted:false};
}
