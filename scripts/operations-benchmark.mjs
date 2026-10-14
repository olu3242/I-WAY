import {spawn} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {mkdir,writeFile,readFile,realpath,lstat} from 'node:fs/promises';
import {tmpdir,cpus,availableParallelism} from 'node:os';
import {resolve,dirname,join,relative,sep} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {fixture,password} from '../tests/helpers/operations-fixture.mjs';
import {addUser} from '../server/operations-auth.mjs';
import {OperationsStore} from '../server/operations-store.mjs';
import {Operations} from '../domain/operations.mjs';
import {createOperationsFeatures} from '../domain/operations-features.mjs';
import {runRuntimeTick} from '../domain/operations-runtime.mjs';

const scriptPath=fileURLToPath(import.meta.url);
const hash=value=>createHash('sha256').update(value).digest('hex');
const percentile=(values,p)=>values.length?[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.ceil(values.length*p)-1)]:null;
function bol(load){return JSON.stringify({loadReference:load.reference,shipper:'Illustrative performance shipper',consignee:'Illustrative performance consignee',commodity:load.commodity,weightLb:load.weightLb,pickupLocation:load.stops[0].location,deliveryLocation:load.stops.at(-1).location});}
function command(ops,actorId,action,record,payload={}){return ops.execute(actorId,{action,resourceId:record.id,expectedVersion:record.version,payload,idempotencyKey:randomUUID()});}
async function performanceWorker(taskPath){
 const file=await realpath(resolve(taskPath)),root=dirname(file),temporary=await realpath(tmpdir()),child=relative(temporary,root);
 if(!child.startsWith('iway-ops-test-')||child.includes(sep)||(await lstat(file)).isSymbolicLink()||typeof process.send!=='function')throw new Error('An isolated performance fixture and parent IPC are required');
 const task=JSON.parse(await readFile(file,'utf8'));
 if(task.purpose!=='isolated-performance-fixture'||!['dispatch','workflow','documents','tenant_isolation'].includes(task.scenario)||!Array.isArray(task.items)||task.items.length>100)throw new Error('Invalid performance fixture');
 const store=new OperationsStore(join(root,'operations.sqlite')),ops=new Operations(store,createOperationsFeatures());
 process.send({type:'ready'});await new Promise(accept=>process.once('message',message=>{if(message?.type==='start')accept();else process.exit(2)}));
 const cpuStart=process.cpuUsage(),samplesMs=[],outcomes={success:0,expectedConflict:0,expectedDenial:0,unexpectedError:0};let work=0,maxRssBytes=process.memoryUsage().rss,maxHeapBytes=process.memoryUsage().heapUsed;
 try{
  for(const item of task.items){
   const started=performance.now();
   try{
    if(task.scenario==='dispatch'){
     command(ops,task.actorId,'load:assign',{id:item.id,version:item.version},{driverId:item.driverId,vehicleId:item.vehicleId,reason:'Illustrative concurrent dispatch benchmark'});outcomes.success++;work++;
    }else if(task.scenario==='workflow'){
     work+=await runRuntimeTick(ops,{workerId:'benchmark-'+process.pid});outcomes.success++;
    }else if(task.scenario==='documents'){
     const load=store.get('load',item.id,task.tenantId),doc=command(ops,task.actorId,'document:ingest',load,{type:'BOL',mimeType:'application/json',content:bol(load)});
     command(ops,task.actorId,'document:review',doc,{decision:'validate',reason:'Illustrative benchmark document review'});outcomes.success++;work++;
    }else{
     let denied=false;try{command(ops,task.actorId,'document:scan',{id:item.id,version:item.version})}catch(error){denied=error.status===404}
     const state=ops.state(task.actorId);if(!denied||state.loads.length!==0)throw new Error('Isolation invariant failed');
     outcomes.expectedDenial++;work++;
    }
   }catch(error){
    if(task.scenario==='dispatch'&&['STALE','INELIGIBLE'].includes(error.code))outcomes.expectedConflict++;
    else outcomes.unexpectedError++;
   }
   samplesMs.push(performance.now()-started);
   const memory=process.memoryUsage();maxRssBytes=Math.max(maxRssBytes,memory.rss);maxHeapBytes=Math.max(maxHeapBytes,memory.heapUsed);
  }
 }finally{store.close()}
 const cpu=process.cpuUsage(cpuStart),usage=process.resourceUsage();
 const result={samplesMs,outcomes,work,resources:{userCpuMs:cpu.user/1000,systemCpuMs:cpu.system/1000,peakRssBytes:Math.max(maxRssBytes,(usage.maxRSS||0)*1024),sampledPeakHeapBytes:maxHeapBytes}};
 process.send({type:'result',result},()=>process.disconnect());
}
async function executeWorkers(root,scenario,tasks){
 const children=[],started=performance.now();
 try{
  for(let index=0;index<tasks.length;index++){
   const taskFile=join(root,'performance-'+scenario+'-'+index+'.json');
   await writeFile(taskFile,JSON.stringify({purpose:'isolated-performance-fixture',scenario,...tasks[index]}));
   const child=spawn(process.execPath,[scriptPath,'--worker',taskFile],{windowsHide:true,stdio:['ignore','ignore','pipe','ipc']});children.push(child);
   child.done=new Promise((accept,reject)=>{
    let report=null,ready=false,stderr=false;
    child.ready=new Promise((resolveReady,rejectReady)=>{
     child.on('message',message=>{if(message?.type==='ready'){ready=true;resolveReady()}else if(message?.type==='result')report=message.result});
     child.once('error',error=>{rejectReady(error);reject(error)});
     child.once('close',code=>{if(!ready)rejectReady(new Error('Fixture worker failed before readiness'));if(code!==0||!report||stderr)reject(new Error('Fixture worker failed'));else accept(report)});
    });
    child.stderr.on('data',()=>{stderr=true});
   });
  }
  const timeout=new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Local performance scenario timed out')),30000);for(const child of children)child.once('close',()=>{if(children.every(c=>c.exitCode!==null||c.signalCode!==null))clearTimeout(timer)});});
  await Promise.race([Promise.all(children.map(c=>c.ready)),timeout]);const workStarted=performance.now();
  for(const child of children)child.send({type:'start'});
  const results=await Promise.race([Promise.all(children.map(c=>c.done)),timeout]),elapsedMs=performance.now()-workStarted;
  const samples=results.flatMap(r=>r.samplesMs),outcomes=results.reduce((sum,r)=>Object.fromEntries(Object.keys(sum).map(key=>[key,sum[key]+r.outcomes[key]])),{success:0,expectedConflict:0,expectedDenial:0,unexpectedError:0});
  const work=results.reduce((sum,r)=>sum+r.work,0);
  return {scenario,concurrency:tasks.length,startupMs:workStarted-started,elapsedMs,latency:{unit:scenario==='workflow'?'checkpoint batch':scenario==='documents'?'ingest and review pair':'command and authorization',samples:samples.length,p50Ms:percentile(samples,.5),p95Ms:percentile(samples,.95),maxMs:Math.max(...samples)},work,throughputPerSecond:work/(elapsedMs/1000),outcomes,unexpectedErrorRate:outcomes.unexpectedError/samples.length,
   resources:{workerUserCpuMs:results.reduce((s,r)=>s+r.resources.userCpuMs,0),workerSystemCpuMs:results.reduce((s,r)=>s+r.resources.systemCpuMs,0),maxWorkerRssBytes:Math.max(...results.map(r=>r.resources.peakRssBytes)),maxWorkerHeapBytes:Math.max(...results.map(r=>r.resources.sampledPeakHeapBytes))}};
 }finally{
  for(const child of children)if(child.exitCode===null&&child.signalCode===null)child.kill('SIGTERM');
  await Promise.all(children.map(child=>child.exitCode!==null||child.signalCode!==null?Promise.resolve():new Promise(accept=>child.once('close',accept))));
 }
}
export async function runPerformanceScenarios({workers=4,rounds=6}={}){
 if(!Number.isInteger(workers)||workers<2||workers>4||!Number.isInteger(rounds)||rounds<2||rounds>20)throw new Error('Use 2–4 local workers and 2–20 rounds');
 const cleanup=[],f=await fixture({after:callback=>cleanup.push(callback)},createOperationsFeatures()),reports=[],runId=randomUUID();
 try{
  const pairs=[];
  for(let i=0;i<rounds;i++){
   let driver=addUser(f.store,{tenantId:f.manager.tenantId,role:'driver',username:'performance-driver-'+i+'@illustrative.invalid',name:'Illustrative benchmark driver',password});
   let record=f.store.get('driver',driver.id,f.manager.tenantId);record=f.command(f.manager,'driver:update',record,{expiresOn:'2099-12-31',reason:'Illustrative benchmark eligibility'});f.command(f.manager,'driver:approve',record,{approved:true,reason:'Illustrative carrier approval'});
   let vehicle=f.command(f.manager,'vehicle:create',null,{name:'Illustrative performance vehicle '+i,capacityLb:45000});vehicle=f.command(f.manager,'vehicle:approve',vehicle,{approved:true,reason:'Illustrative carrier approval'});
   let load=f.createLoad();load=f.command(f.dispatcher,'load:validate',load);pairs.push({id:load.id,version:load.version,driverId:driver.id,vehicleId:vehicle.id});
  }
  const dispatch=await executeWorkers(f.root,'dispatch',Array.from({length:workers},()=>({actorId:f.dispatcher.id,tenantId:f.manager.tenantId,items:pairs})));
  const claims=f.store.list('assignment',f.manager.tenantId).filter(a=>a.status==='active');
  dispatch.invariants={oneActiveAssignmentPerLoad:claims.length===rounds&&new Set(claims.map(a=>a.loadId)).size===rounds,exactWinners:dispatch.outcomes.success===rounds,expectedConflictCount:dispatch.outcomes.expectedConflict===rounds*(workers-1)};reports.push(dispatch);
  const jobs=[];for(let i=0;i<rounds;i++){const load=f.createLoad();jobs.push(f.command(f.manager,'orchestration:request',load))}
  const workflow=await executeWorkers(f.root,'workflow',Array.from({length:workers},()=>({actorId:f.manager.id,tenantId:f.manager.tenantId,items:Array.from({length:rounds+5},()=>({}))})));
  const jobIds=new Set(jobs.map(j=>j.id)),decisions=f.store.list('agentdecision',f.manager.tenantId).filter(d=>jobIds.has(d.jobId));
  workflow.invariants={everyJobCompleted:jobs.every(j=>f.store.get('orchestration',j.id,f.manager.tenantId).status==='completed'),exactlyOneDecisionPerCheckpoint:decisions.length===rounds*5&&new Set(decisions.map(d=>d.jobId+':'+d.checkpoint)).size===rounds*5,workMatchesPersistedDecisions:workflow.work===decisions.length};reports.push(workflow);
  const documentTasks=Array.from({length:workers},()=>({actorId:f.manager.id,tenantId:f.manager.tenantId,items:Array.from({length:rounds},()=>{const load=f.createLoad();return {id:load.id,version:load.version}})}));
  const documents=await executeWorkers(f.root,'documents',documentTasks);
  documents.invariants={allDocumentsValidated:f.store.list('document',f.manager.tenantId).filter(d=>d.status==='validated').length===workers*rounds,allDocumentPairsSucceeded:documents.outcomes.success===workers*rounds};reports.push(documents);
  const isolation=await executeWorkers(f.root,'tenant_isolation',Array.from({length:workers},()=>({actorId:f.outsider.id,tenantId:f.outsider.tenantId,items:pairs})));
  isolation.invariants={allCrossTenantRequestsDenied:isolation.outcomes.expectedDenial===workers*rounds,noForeignResourcesInOtherTenant:f.store.list('load',f.outsider.tenantId).length===0};reports.push(isolation);
  return {format:'iway-performance-evidence',version:1,runId,capturedAt:new Date().toISOString(),configuration:{workers,rounds},environment:{node:process.version,platform:process.platform,arch:process.arch,logicalCpus:availableParallelism(),cpuModel:cpus()[0]?.model??'unavailable'},scope:'Isolated local SQLite regression workload; not hosted capacity or an SLO',scenarios:reports,correctnessPassed:reports.every(r=>r.outcomes.unexpectedError===0&&Object.values(r.invariants).every(Boolean)),hostedCertified:false};
 }finally{for(const callback of cleanup)await callback()}
}
export function calibratePerformance(report){
 return {format:'iway-performance-baseline',version:1,runId:report.runId,capturedAt:report.capturedAt,configuration:report.configuration,environment:report.environment,
  policy:'Local regression limits: p95 at most 4× measured calibration with a 750ms floor; throughput at least 1/5 calibration; peak worker RSS at most 2× calibration with a 192MiB floor. These are regression budgets, not production promises.',
  scenarios:report.scenarios.map(s=>({scenario:s.scenario,measured:{p95Ms:s.latency.p95Ms,throughputPerSecond:s.throughputPerSecond,maxWorkerRssBytes:s.resources.maxWorkerRssBytes},budgets:{p95Ms:Math.max(750,Math.ceil(s.latency.p95Ms*4)),minThroughputPerSecond:s.throughputPerSecond/5,maxWorkerRssBytes:Math.max(192*1024*1024,s.resources.maxWorkerRssBytes*2),maxUnexpectedErrors:0}}))};
}
export function evaluatePerformance(report,baseline){
 if(baseline?.format!=='iway-performance-baseline'||baseline.version!==1||report.runId===baseline.runId||JSON.stringify(report.configuration)!==JSON.stringify(baseline.configuration))return {status:'FAIL',reason:'A separate measured baseline with matching workload configuration is required.',checks:[]};
 const checks=report.scenarios.map(s=>{
  const budgets=baseline.scenarios.find(b=>b.scenario===s.scenario)?.budgets;
  return {scenario:s.scenario,latencyPassed:!!budgets&&s.latency.p95Ms<=budgets.p95Ms,throughputPassed:!!budgets&&s.throughputPerSecond>=budgets.minThroughputPerSecond,memoryPassed:!!budgets&&s.resources.maxWorkerRssBytes<=budgets.maxWorkerRssBytes,errorsPassed:s.outcomes.unexpectedError===0,invariantsPassed:Object.values(s.invariants).every(Boolean)};
 });
 return {status:report.correctnessPassed&&checks.length===4&&checks.every(c=>Object.entries(c).every(([key,value])=>key==='scenario'||value===true))?'PASS':'FAIL',checks,baselineCapturedAt:baseline.capturedAt};
}
async function main(){
 if(process.argv[2]==='--worker'){await performanceWorker(process.argv[3]);return;}
 const args=process.argv.slice(2),calibrating=args[0]==='--calibrate';
 if(args.length&&(!calibrating||args.length!==2))throw new Error('Usage: node scripts/operations-benchmark.mjs [--calibrate NEW_BASELINE_FILE]');
 const report=await runPerformanceScenarios(),outputPath=resolve('dist/operations-evidence/performance.json');await mkdir(dirname(outputPath),{recursive:true});
 if(calibrating){
  if(!report.correctnessPassed)throw new Error('Calibration correctness checks failed');
  const baseline=calibratePerformance(report);await writeFile(args[1],JSON.stringify(baseline,null,2)+'\n',{flag:'wx'});
  const result={...report,status:'BASELINE_ONLY',baselineSha256:hash(JSON.stringify(baseline))};await writeFile(outputPath,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,scenarios:report.scenarios.map(s=>({scenario:s.scenario,p95Ms:s.latency.p95Ms,throughputPerSecond:s.throughputPerSecond}))}));return;
 }
 const baselineBytes=await readFile('docs/operations/PERFORMANCE_BASELINE.json','utf8'),baseline=JSON.parse(baselineBytes),verification=evaluatePerformance(report,baseline),result={...report,...verification,baselineSha256:hash(baselineBytes)};
 await writeFile(outputPath,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));if(result.status!=='PASS')process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 main().catch(()=>{console.error(JSON.stringify({status:'FAIL',error:'Isolated performance verification did not complete.'}));process.exitCode=1});
}
