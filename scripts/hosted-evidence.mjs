import {resolve,relative,isAbsolute} from 'node:path';
import {execFileSync} from 'node:child_process';
import {boundedJSON,digest,emptyHostedIntakeAssessment,verifyAuthorization,exact} from '../domain/hosted-evidence.mjs';
import {sourceFingerprint} from '../domain/operations-certification.mjs';
import {HostedEvidenceStore,safeRead} from '../server/hosted-evidence-store.mjs';
import {hostedScenarios} from '../domain/operations-release.mjs';
import {assessIndependentHostedRelease} from '../domain/independent-hosted-release.mjs';

// Trust configuration is operator-installed and pinned out of band, never uploaded as evidence.
const [command,rootArg,id]=process.argv.slice(2);let store;
try{
 const sourceHash=sourceFingerprint(process.cwd());
 if(command==='dry-run')console.log(JSON.stringify({...emptyHostedIntakeAssessment(sourceHash),plan:hostedScenarios}));
 else{
  if(!['intake','validate','inspect','reconcile','preflight','execute','readiness'].includes(command))throw Error('COMMAND_INVALID');
  if(!rootArg)throw Error('EVIDENCE_ROOT_REQUIRED');
  const root=resolve(rootArg),trustRoot=process.env.IWAY_EVIDENCE_TRUST_ROOT,pin=process.env.IWAY_EVIDENCE_TRUST_SHA256;
  if(!trustRoot||!/^[a-f0-9]{64}$/.test(pin??''))throw Error('PINNED_TRUST_NOT_PROVISIONED');
  const rel=relative(root,resolve(trustRoot));if(!rel||!rel.startsWith('..')&&!isAbsolute(rel))throw Error('TRUST_MUST_BE_OUTSIDE_INTAKE');
  const raw=safeRead(resolve(trustRoot),'policy.json');if(digest(raw)!==pin)throw Error('TRUST_PIN_MISMATCH');
  const config=JSON.parse(raw.toString());exact(config,['tenant','environment','keys','revokedAuthorizations','revokedAttestations','ledgerDigest']);
  const policy={...config,readAttestation:hash=>safeRead(root,`attestations/${hash}.json`)};
  const binding={tenant:config.tenant,environment:config.environment,sourceHash,gitSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()};
  const now=new Date().toISOString(),authorization=()=>boundedJSON(safeRead(root,'authorization.json'));
  if(['preflight','execute'].includes(command)){
   const grant=verifyAuthorization(authorization(),policy,binding,now);
   console.log(JSON.stringify({authorization:'VERIFIED',authorizationRef:grant.id,hostedExecuted:false,status:'BLOCKED',reason:'TRUSTED_TRANSPORT_NOT_INSTALLED'}));if(command==='execute')process.exitCode=2;
  }else{
   store=new HostedEvidenceStore({database:resolve(root,'ledger.sqlite'),artifactRoot:root,policy,binding});
   let report;
   if(command==='intake')report=store.apply(boundedJSON(safeRead(root,'request.json')));
   else if(['validate','inspect'].includes(command))report=store.inspect(id);
   else if(command==='reconcile')report=store.reconcile();
   else {
    const optional=name=>{try{return boundedJSON(safeRead(root,name))}catch(e){if(e.code==='ENOENT')return undefined;throw e}};
    report=assessIndependentHostedRelease({store,authorization:authorization(),securityApproval:optional('security-approval.json'),productionApproval:optional('production-approval.json'),now});
   }
   console.log(JSON.stringify(report));
  }
 }
}catch(e){console.error(JSON.stringify({status:'BLOCKED',code:/^[A-Z_]+$/.test(e.message)?e.message:'EVIDENCE_OPERATION_FAILED',hostedExecuted:false}));process.exitCode=2}
finally{store?.close()}
