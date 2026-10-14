import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{resolve,dirname}from'node:path';import{fileURLToPath}from'node:url';
import{sourceFingerprint}from'../domain/operations-certification.mjs';import{prepareHostedSandbox,validateHostedSandbox}from'../domain/hosted-sandbox-preparation.mjs';import{createHostedExecutionPreparation,validateHostedExecutionPreparation}from'../domain/hosted-execution-preparation.mjs';import{assessHostedEvidenceInventory,validateHostedEvidenceInventory}from'../domain/hosted-evidence-inventory.mjs';import{createHostedReleaseDossier,validateHostedReleaseDossier}from'../domain/hosted-release-dossier.mjs';import{assessScenarioRelease}from'../domain/scenario-release-evidence.mjs';import{deriveLocalRemediationEvidence,validateLocalRemediationEvidence}from'../domain/local-remediation-evidence.mjs';import{assessRemediationWave}from'../domain/remediation-wave.mjs';import{createReleaseAssessment,validateReleaseAssessment,hostedReadiness}from'../domain/operations-release.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=resolve(root,'dist/operations-evidence');
try{
 mkdirSync(out,{recursive:true});
 if(process.argv[2]==='hosted-plan'){
  const report=hostedReadiness();writeFileSync(resolve(out,'hosted-readiness.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:report.status,executed:false,scenarios:report.scenarios.length,artifact:'dist/operations-evidence/hosted-readiness.json'}));
 }else{
  const cert=JSON.parse(readFileSync(resolve(out,'certification.json'),'utf8')),options={sourceHash:sourceFingerprint(root),readArtifact:name=>readFileSync(resolve(out,name))};
  const report=process.argv[2]==='validate'?JSON.parse(readFileSync(resolve(out,'release.json'),'utf8')):createReleaseAssessment(cert,options);
  const result=validateReleaseAssessment(report,cert,options);
  // B245-B255 evidence intake is offline and intentionally empty until independently observed.
  const scenarioAssessment=assessScenarioRelease(options.sourceHash,options.readArtifact);
  const scenarioPath=resolve(out,'scenario-release-evidence.json');
  if(process.argv[2]==='validate'){
   const savedScenario=JSON.parse(readFileSync(scenarioPath,'utf8'));
   if(JSON.stringify(savedScenario)!==JSON.stringify(scenarioAssessment))throw Error('SCENARIO_RELEASE_EVIDENCE_MISMATCH');
  }else writeFileSync(scenarioPath,JSON.stringify(scenarioAssessment,null,2)+'\n');
  const hostedOptions={sourceHash:options.sourceHash,localScenarioStatus:scenarioAssessment.status};
  const dossier=createHostedReleaseDossier(hostedOptions);
  const dossierPath=resolve(out,'hosted-certification-dossier.json');
  if(process.argv[2]==='validate')validateHostedReleaseDossier(JSON.parse(readFileSync(dossierPath,'utf8')),hostedOptions);
  else writeFileSync(dossierPath,JSON.stringify(dossier,null,2)+'\n');
  const inventoryOptions={sourceHash:options.sourceHash};
  const inventory=assessHostedEvidenceInventory(inventoryOptions);
  const inventoryPath=resolve(out,'hosted-evidence-inventory.json');
  if(process.argv[2]==='validate')validateHostedEvidenceInventory(JSON.parse(readFileSync(inventoryPath,'utf8')),inventoryOptions);
  else writeFileSync(inventoryPath,JSON.stringify(inventory,null,2)+'\n');
  const preparationOptions={sourceHash:options.sourceHash};
  const preparation=createHostedExecutionPreparation(preparationOptions);
  const preparationPath=resolve(out,'hosted-execution-preparation.json');
  if(process.argv[2]==='validate')validateHostedExecutionPreparation(JSON.parse(readFileSync(preparationPath,'utf8')),preparationOptions);
  else writeFileSync(preparationPath,JSON.stringify(preparation,null,2)+'\n');
  const sandboxInput={environment:'non-production',sourceHash:options.sourceHash,operator:'sandbox-owner',consentVersion:'2026-10-13.1',consentApproved:false,restrictedIdentityReviewed:false,rotationEvidenceReviewed:false,rollbackPlanReviewed:false,syntheticFixtureApproved:false,authorizationReviewed:false};
  const sandbox=prepareHostedSandbox(sandboxInput);
  const sandboxPath=resolve(out,'hosted-sandbox-preparation.json');
  if(process.argv[2]==='validate')validateHostedSandbox(JSON.parse(readFileSync(sandboxPath,'utf8')),sandboxInput);
  else writeFileSync(sandboxPath,JSON.stringify(sandbox,null,2)+'\n');
  const remediation=assessRemediationWave({sourceHash:options.sourceHash});
  const localEvidence=deriveLocalRemediationEvidence(cert,options);
  const localPath=resolve(out,'local-remediation-evidence.json');
  if(process.argv[2]==='validate'){
   validateLocalRemediationEvidence(JSON.parse(readFileSync(localPath,'utf8')),cert,options);
  }else writeFileSync(localPath,JSON.stringify(localEvidence,null,2)+'\n');
  const remediationPath=resolve(out,'remediation.json');
  if(process.argv[2]==='validate'){
   const saved=JSON.parse(readFileSync(remediationPath,'utf8'));
   if(JSON.stringify(saved)!==JSON.stringify(remediation))throw Error('REMEDIATION_EVIDENCE_MISMATCH');
  }else writeFileSync(remediationPath,JSON.stringify(remediation,null,2)+'\n');
  if(process.argv[2]!=='validate')writeFileSync(resolve(out,'release.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({...result,scenarioStatus:scenarioAssessment.status,hostedDossier:'dist/operations-evidence/hosted-certification-dossier.json',hostedInventory:'dist/operations-evidence/hosted-evidence-inventory.json',hostedPreparation:'dist/operations-evidence/hosted-execution-preparation.json',hostedSandbox:'dist/operations-evidence/hosted-sandbox-preparation.json',scenarioArtifact:'dist/operations-evidence/scenario-release-evidence.json',remediationStatus:'BLOCKED',localEvidenceStatus:'LOCAL_GATE_EVIDENCE_ONLY',localEvidenceArtifact:'dist/operations-evidence/local-remediation-evidence.json',remediationArtifact:'dist/operations-evidence/remediation.json',artifact:'dist/operations-evidence/release.json'}));
 }
}catch{console.error(JSON.stringify({status:'BLOCKED',category:'RELEASE_EVIDENCE_INVALID',message:'Run and validate the current local evidence gates. Hosted release remains NO-GO.'}));process.exitCode=1;}
