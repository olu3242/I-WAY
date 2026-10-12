// Controlled, isolated SQLite transaction acquisition experiment.
// This is a diagnostic only, not an application benchmark or production SLO.
import {DatabaseSync} from 'node:sqlite';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';

const percentile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.ceil(values.length*p)-1)];
export async function runContentionExperiment({workers=4,iterations=20}={}){
 if(!Number.isInteger(workers)||workers<1||workers>4||!Number.isInteger(iterations)||iterations<5||iterations>100)throw new RangeError('Use 1-4 workers and 5-100 iterations');
 const dir=await mkdtemp(join(tmpdir(),'iway-lock-experiment-'));
 try{
  const dbPath=join(dir,'isolated.sqlite');
  const db=new DatabaseSync(dbPath);
  try{db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE samples(id INTEGER PRIMARY KEY, value INTEGER NOT NULL); INSERT INTO samples(id,value) VALUES(1,0)')}finally{db.close()}
  const children=Array.from({length:workers},()=>spawn(process.execPath,[resolve('scripts/operations-lock-experiment.mjs'),'--worker',dbPath,String(iterations)],{stdio:['ignore','pipe','pipe'],windowsHide:true}));
  const results=await Promise.all(children.map(child=>new Promise((accept,reject)=>{
   let stdout='',stderr='';
   child.stdout.on('data',chunk=>{stdout+=chunk;if(stdout.length>65536)child.kill()});
   child.stderr.on('data',chunk=>{stderr+=chunk;if(stderr.length>65536)child.kill()});
   child.once('error',reject);
   child.once('close',code=>{if(code!==0)return reject(new Error('Isolated worker failed'));try{accept(JSON.parse(stdout))}catch{reject(new Error('Invalid isolated worker output'))}});
  })));
  const verify=new DatabaseSync(dbPath,{readOnly:true});
  let actual;try{actual=verify.prepare('SELECT value FROM samples WHERE id=1').get().value}finally{verify.close()}
  if(actual!==workers*iterations)throw new Error('Experiment correctness invariant failed');
  const acquisitions=results.flatMap(result=>result.acquireMs);
  return {format:'iway-isolated-lock-experiment',version:1,diagnosticOnly:true,certified:false,hostedCertified:false,workers,iterations,committed:actual,acquireP50Ms:percentile(acquisitions,.5),acquireP95Ms:percentile(acquisitions,.95),acquireMaxMs:Math.max(...acquisitions),interpretation:'Separate isolated SQLite fixture; compare repeated 1-worker and 4-worker runs. Not proof of application bottleneck.'};
 }finally{await rm(dir,{recursive:true,force:true})}
}
function worker(dbPath,iterations){
 const db=new DatabaseSync(dbPath),acquireMs=[];
 try{
  db.exec('PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL');
  const update=db.prepare('UPDATE samples SET value=value+1 WHERE id=1');
  for(let i=0;i<iterations;i++){
   const started=performance.now();db.exec('BEGIN IMMEDIATE');acquireMs.push(performance.now()-started);
   try{update.run();db.exec('COMMIT')}catch(error){db.exec('ROLLBACK');throw error}
  }
 }finally{db.close()}
 process.stdout.write(JSON.stringify({acquireMs})+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv[2]==='--worker'){try{worker(process.argv[3],Number(process.argv[4]))}catch{process.exitCode=1}}
 else if(process.argv.length===2){runContentionExperiment().then(r=>console.log(JSON.stringify(r,null,2))).catch(()=>{console.error(JSON.stringify({status:'FAIL',reason:'EXPERIMENT_FAILED'}));process.exitCode=1})}
 else{console.error(JSON.stringify({status:'FAIL',reason:'INVALID_ARGUMENTS'}));process.exitCode=1}
}
