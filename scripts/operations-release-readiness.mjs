import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{resolve,dirname}from'node:path';import{fileURLToPath}from'node:url';
import{sourceFingerprint}from'../domain/operations-certification.mjs';import{createReleaseAssessment,validateReleaseAssessment,hostedReadiness}from'../domain/operations-release.mjs';
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
  if(process.argv[2]!=='validate')writeFileSync(resolve(out,'release.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({...result,artifact:'dist/operations-evidence/release.json'}));
 }
}catch{console.error(JSON.stringify({status:'BLOCKED',category:'RELEASE_EVIDENCE_INVALID',message:'Run and validate the current local evidence gates. Hosted release remains NO-GO.'}));process.exitCode=1;}
