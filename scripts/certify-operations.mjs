import{spawn,execFileSync}from'node:child_process';import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{resolve,dirname}from'node:path';import{fileURLToPath}from'node:url';
import{sourceFingerprint,parseCounts,createCertification,validateCertification,sha256,artifactNames}from'../domain/operations-certification.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=resolve(root,'dist/operations-evidence');
const gates={verify:'npm run verify',browser:'npm run test:browser',performance:'npm run ops:benchmark',recovery:'npm run ops:recovery:verify',evaluation:'npm run ops:evaluate',publicTarget:'npm run verify:public-target'};
async function run(command){return new Promise(accept=>{
 const child=process.platform==='win32'?spawn('cmd.exe',['/d','/s','/c',command],{cwd:root,windowsHide:true,env:{...process.env,NO_COLOR:'1',FORCE_COLOR:'0'},stdio:['ignore','pipe','pipe']}):spawn('/bin/sh',['-c',command],{cwd:root,env:{...process.env,NO_COLOR:'1'},stdio:['ignore','pipe','pipe']});
 let log='';child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);child.on('error',()=>accept({exitCode:1,log:'Gate could not start.'}));child.on('close',exitCode=>accept({exitCode:exitCode??1,log}));
})}
try{
 if(process.argv[2]==='validate'){
  const m=JSON.parse(readFileSync(resolve(out,'certification.json'),'utf8'));console.log(JSON.stringify(validateCertification(m,{sourceHash:sourceFingerprint(root),readArtifact:name=>readFileSync(resolve(out,name))})));
 }else{
  mkdirSync(out,{recursive:true});const before=sourceFingerprint(root),baseCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),evidence={};
  for(const[name,command]of Object.entries(gates)){
   console.log('Running local gate: '+name);const result=await run(command),logFile=name+'.log';writeFileSync(resolve(out,logFile),result.log);
   evidence[name]={command,exitCode:result.exitCode,logFile,logSha256:sha256(result.log),...(['verify','browser'].includes(name)?{counts:parseCounts(result.log,name)}:{})};
   if(result.exitCode===0&&artifactNames[name]){
    const artifactFile=artifactNames[name],raw=readFileSync(name==='browser'?resolve(root,'dist/browser-evidence.json'):resolve(out,artifactFile));
    if(name==='browser')writeFileSync(resolve(out,artifactFile),raw);
    evidence[name].artifact={file:artifactFile,sha256:sha256(raw)};
   }
   console.log(JSON.stringify({gate:name,exitCode:result.exitCode,...(evidence[name].counts??{})}));
   if(result.exitCode!==0)break;
  }
  const after=sourceFingerprint(root);if(before!==after)throw Error('SOURCE_CHANGED');
  const manifest=createCertification({sourceHash:after,baseCommit,evidence});writeFileSync(resolve(out,'certification.json'),JSON.stringify(manifest,null,2)+'\n');
  const validated=validateCertification(manifest,{sourceHash:after,readArtifact:name=>readFileSync(resolve(out,name))});
  console.log(JSON.stringify({...validated,manifest:'dist/operations-evidence/certification.json'}));
 }
}catch(error){console.error(JSON.stringify({status:'FAIL',category:['SOURCE_CHANGED','STALE_SOURCE','TEST_GATE_FAILED','LOCAL_GATE_FAILED','EVIDENCE_MISSING','EVIDENCE_CHANGED'].includes(error?.message)?error.message:'CERTIFICATION_INVALID',message:'Local certification did not pass. Inspect the local evidence artifacts; hosted release remains NO-GO.'}));process.exitCode=1;}
