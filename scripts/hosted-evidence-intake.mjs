// Offline metadata intake only; no external connections or secret collection.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sourceFingerprint} from '../domain/operations-certification.mjs';
import {assessHostedEvidenceIntake,validateHostedEvidenceIntake} from '../domain/hosted-evidence-intake.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=resolve(root,'dist/operations-evidence');
const artifact=resolve(out,'hosted-evidence-intake.json');
try{
 const sourceHash=sourceFingerprint(root);
 const records={}; // Deliberately no automatic approvals or user-controlled approval file.
 const options={sourceHash,records};
 if(process.argv[2]==='validate'){
  console.log(JSON.stringify(validateHostedEvidenceIntake(JSON.parse(readFileSync(artifact,'utf8')),options)));
 }else{
  mkdirSync(out,{recursive:true});
  const report=assessHostedEvidenceIntake(options);
  if(sourceFingerprint(root)!==sourceHash)throw Error('SOURCE_CHANGED');
  writeFileSync(artifact,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({valid:true,decision:report.decision,missing:report.missing,hostedExecuted:false,artifact:'dist/operations-evidence/hosted-evidence-intake.json'}));
 }
}catch(e){
 console.error(JSON.stringify({status:'BLOCKED',diagnostic:e?.code==='ENOENT'?'MISSING_ARTIFACT':'INTAKE_INVALID',decision:'NO-GO',hostedExecuted:false}));
 process.exitCode=1;
}
