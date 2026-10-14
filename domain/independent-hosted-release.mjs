import {hostedScenarios} from './operations-release.mjs';
import {remediationBatches} from './remediation-wave.mjs';
import {canonical,digest,exact,verifyAuthorization,verifyEnvelope} from './hosted-evidence.mjs';
import {HostedEvidenceStore} from '../server/hosted-evidence-store.mjs';

export function assessIndependentHostedRelease({store,authorization,securityApproval,productionApproval,now}){
 if(!(store instanceof HostedEvidenceStore))throw Error('TRUSTED_STORE_REQUIRED');
 const records=store.reconcile(),binding=store.binding;
 const grant=verifyAuthorization(authorization,store.policy,binding,now);
 const accepted=records.filter(x=>x.effectiveState==='ACCEPTED'&&x.record.provenance.scope==='independent-hosted'&&x.record.method==='approved-hosted-runner'&&x.record.result==='PASS'&&x.record.authorizationRef===grant.id);
 const missingBatches=Object.keys(remediationBatches).filter(id=>!accepted.some(x=>x.record.batch===id));
 const missingScenarios=hostedScenarios.filter(s=>!accepted.some(x=>x.record.scenario===s.id&&s.checks.every(k=>x.record.assertions[k]===true))).map(s=>s.id);
 const ledgerDigest=digest(canonical(records.map(x=>({id:x.record.id,head:x.auditHead,state:x.effectiveState}))));
 const approve=(envelope,purpose)=>{
  if(!envelope)return false;
  const p=envelope.payload;exact(p,['purpose','tenant','environment','sourceHash','gitSha','ledgerDigest','approvedAt','expiresAt']);
  if(p.purpose!==purpose||p.tenant!==binding.tenant||p.environment!==binding.environment||p.sourceHash!==binding.sourceHash||p.gitSha!==binding.gitSha||p.ledgerDigest!==ledgerDigest||!Number.isFinite(Date.parse(p.approvedAt))||!Number.isFinite(Date.parse(p.expiresAt))||p.approvedAt>now||p.expiresAt<=now)throw Error('RELEASE_APPROVAL_INVALID');
  const key=verifyEnvelope(envelope,store.policy,{purpose,tenant:binding.tenant,environment:binding.environment,at:now});
  if(accepted.some(x=>x.record.collector===key.subjectId))throw Error('INDEPENDENT_RELEASE_APPROVAL_REQUIRED');
  return true;
 };
 const securityApproved=approve(securityApproval,'security-release'),productionApproved=approve(productionApproval,'production-release');
 const checkpointVerified=store.policy.ledgerDigest===ledgerDigest;
 const complete=missingBatches.length===0&&missingScenarios.length===0&&securityApproved&&checkpointVerified;
 return {schemaVersion:1,sourceHash:binding.sourceHash,ledgerDigest,checkpointVerified,accepted:accepted.length,missingBatches,missingScenarios,executionAuthorized:true,hostedExecuted:accepted.some(x=>x.record.scenario!==null),hostedDecision:complete?'GO':'NO-GO',productionDecision:complete&&productionApproved?'GO':'NO-GO',deploymentExecuted:false};
}
