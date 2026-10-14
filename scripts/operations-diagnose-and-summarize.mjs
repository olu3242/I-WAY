// Opt-in local diagnostic capture followed by read-only transaction phase summary.
// This does not run certification, change budgets, or establish hosted readiness.
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {summarizeDiagnosticFile} from './operations-summarize-diagnostic-file.mjs';

export async function captureAndSummarize({run, summarize}){
 const result=await run();
 if(result?.status!=='DIAGNOSTIC_COMPLETE'||typeof result.path!=='string'||!result.path.trim())throw new TypeError('Expected completed diagnostic evidence path');
 const summary=await summarize([result.path]);
 if(summary?.certified!==false||summary?.rootCauseEstablished!==false||summary?.runId!==result.runId)throw new TypeError('Diagnostic summary identity or safety mismatch');
 return {status:'DIAGNOSTIC_SUMMARIZED',runId:result.runId,path:result.path,summary};
}
export async function runLocalDiagnostic(){
 return await new Promise((accept,reject)=>{
  const child=spawn(process.execPath,[resolve('scripts/operations-benchmark.mjs'),'--diagnose-transactions'],{stdio:['ignore','pipe','pipe'],windowsHide:true});
  let stdout='',stderr='';
  const maxBytes=1024*1024;
  child.stdout.on('data',chunk=>{stdout+=chunk;if(stdout.length>maxBytes)child.kill()});
  child.stderr.on('data',chunk=>{stderr+=chunk;if(stderr.length>maxBytes)child.kill()});
  child.on('error',reject);
  child.on('close',code=>{
   if(code!==0)return reject(new Error('Diagnostic benchmark failed'));
   try{accept(JSON.parse(stdout.trim()))}catch{reject(new Error('Invalid diagnostic benchmark output'))}
  });
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.length!==2){console.error(JSON.stringify({status:'FAIL',reason:'NO_ARGUMENTS_SUPPORTED'}));process.exitCode=1}
 else captureAndSummarize({run:runLocalDiagnostic,summarize:summarizeDiagnosticFile})
  .then(result=>console.log(JSON.stringify(result,null,2)))
  .catch(()=>{console.error(JSON.stringify({status:'FAIL',reason:'DIAGNOSTIC_CAPTURE_OR_SUMMARY_FAILED'}));process.exitCode=1});
}
