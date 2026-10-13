// B256-B265 local-only executable scenario gate. No hosted network or production secrets.
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sourceFingerprint,sha256} from '../domain/operations-certification.mjs';
import {validateIsolatedScenarioEvidence} from '../domain/isolated-scenario-evidence.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=resolve(root,'dist/operations-evidence');
const manifest=resolve(out,'isolated-scenarios.json');
const scenarios=Object.freeze([
 {id:'identity',args:['--test','tests/identity.test.mjs'],enabled:false},
 {id:'persistence-isolation-workflow',args:['--test','tests/local/operations-postgres.test.mjs'],enabled:true},
 {id:'integrations',args:['--test','tests/integrations.test.mjs'],enabled:false}
]);
function execute(args){
 return new Promise(done=>{
  const child=spawn(process.execPath,args,{cwd:root,env:{...process.env,IWAY_OPERATIONS_LOCAL_OPT_IN:'1'},stdio:['ignore','pipe','pipe'],windowsHide:true});
  let stdout='',stderr='';
  child.stdout.on('data',b=>stdout+=b.toString());child.stderr.on('data',b=>stderr+=b.toString());
  child.on('error',()=>done({exitCode:1,log:'PROCESS_START_FAILED'}));
  child.on('close',code=>done({exitCode:code??1,log:stdout+stderr}));
 });
}
function validate(report){return validateIsolatedScenarioEvidence(report,{sourceHash:sourceFingerprint(root),readLog:name=>readFileSync(resolve(out,name))});}

try{
 mkdirSync(out,{recursive:true});
 if(process.argv[2]==='validate'){
  console.log(JSON.stringify(validate(JSON.parse(readFileSync(manifest,'utf8')))));
 }else{
  if(process.env.IWAY_OPERATIONS_LOCAL_OPT_IN!=='1')throw Error('LOCAL_OPT_IN_REQUIRED');
  const before=sourceFingerprint(root),results=[];
  for(const spec of scenarios){
   if(!spec.enabled){results.push({id:spec.id,status:'NOT_EXECUTED',logFile:null});continue;}
   const result=await execute(spec.args),logFile=spec.id+'.log';
   writeFileSync(resolve(out,logFile),result.log);
   results.push({id:spec.id,status:result.exitCode===0?'PASS':'FAIL',exitCode:result.exitCode,logFile,logSha256:sha256(result.log)});
  }
  if(sourceFingerprint(root)!==before)throw Error('SOURCE_CHANGED');
  const report={schemaVersion:1,sourceHash:before,scope:'isolated-local',hostedExecuted:false,hostedDecision:'NO-GO',scenarios:results};
  writeFileSync(manifest,JSON.stringify(report,null,2)+'\n');
  const verdict=validate(report);console.log(JSON.stringify({...verdict,artifact:'dist/operations-evidence/isolated-scenarios.json'}));
  if(verdict.localStatus==='FAIL')process.exitCode=1;
 }
}catch(e){console.error(JSON.stringify({status:'FAIL',category:e.message}));process.exitCode=1;}
