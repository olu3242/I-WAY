// B266 offline preflight: never opens a hosted connection or reads secrets.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sourceFingerprint} from '../domain/operations-certification.mjs';
import {createHostedPreflight,validateHostedPreflight} from '../domain/hosted-readiness-preflight.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=resolve(root,'dist/operations-evidence');
const file=resolve(out,'hosted-readiness-preflight.json');
try{
 const options={sourceHash:sourceFingerprint(root)};
 if(process.argv[2]==='validate'){
  const report=JSON.parse(readFileSync(file,'utf8'));
  console.log(JSON.stringify(validateHostedPreflight(report,options)));
 }else{
  mkdirSync(out,{recursive:true});
  const report=createHostedPreflight(options);
  if(sourceFingerprint(root)!==options.sourceHash)throw Error('SOURCE_CHANGED');
  writeFileSync(file,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:'BLOCKED',decision:report.decision,hostedExecuted:false,phases:report.phases,artifact:'dist/operations-evidence/hosted-readiness-preflight.json'}));
 }
}catch(error){
 const codes=new Set(['SOURCE_CHANGED','PREFLIGHT_EVIDENCE_MISMATCH','PREFLIGHT_SOURCE_INVALID']);
 console.error(JSON.stringify({status:'BLOCKED',diagnostic:codes.has(error?.message)?error.message:error?.code==='ENOENT'?'MISSING_ARTIFACT':'PREFLIGHT_INVALID',hostedExecuted:false,decision:'NO-GO'}));
 process.exitCode=1;
}
