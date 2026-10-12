// Read-only aggregation of opt-in worker transaction timings.
// No identities, SQL, payloads, hostnames, or transaction bodies are accepted or retained.
const phases=['acquireMs','executeMs','finalizeMs'];
const scenarios=['dispatch','workflow','documents','tenant_isolation'];
const validNumber=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const percentile=(samples,p)=>samples.length?[...samples].sort((a,b)=>a-b)[Math.min(samples.length-1,Math.ceil(samples.length*p)-1)]:null;

export function summarizeTransactionDiagnostics(report){
 if(report?.format!=='iway-performance-evidence'||report.diagnosticOnly!==true||report.certificationComparable!==false||report.certificationStatus!=='NOT_EVALUATED'||!Array.isArray(report.scenarios)||report.scenarios.length!==4)throw new TypeError('Opt-in diagnostic evidence required');
 const seen=new Set();
 const summaries=report.scenarios.map(scenario=>{
  if(!scenarios.includes(scenario?.scenario)||seen.has(scenario.scenario)||!integer(scenario.concurrency)||scenario.concurrency<2||scenario.concurrency>4)throw new TypeError('Invalid diagnostic scenario');
  seen.add(scenario.scenario);
  const workers=scenario.transactionDiagnostics?.workers;
  if(!Array.isArray(workers)||workers.length!==scenario.concurrency)throw new TypeError('Missing worker diagnostics');
  const totals={observed:0,committed:0,rolledBack:0,sampled:0,truncatedWorkers:0};
  const byPhase=Object.fromEntries(phases.map(p=>[p,[]]));
  for(const worker of workers){
   if(worker?.format!=='iway-transaction-phase-diagnostics'||worker.version!==1||!integer(worker.observed)||!integer(worker.committed)||!integer(worker.rolledBack)||!integer(worker.sampled)||worker.committed+worker.rolledBack!==worker.observed||worker.sampled>worker.observed||worker.sampled>100000||worker.truncated!==(worker.observed>worker.sampled))throw new TypeError('Invalid transaction counts');
   for(const name of phases){
    const p=worker.phases?.[name];
    if(!p||!['p50Ms','p95Ms','maxMs'].every(key=>worker.sampled===0?p[key]===null:validNumber(p[key])))throw new TypeError('Invalid phase measurements');
    if(worker.sampled>0&&(p.p50Ms>p.p95Ms||p.p95Ms>p.maxMs))throw new TypeError('Inconsistent phase percentiles');
    if(worker.sampled>0)byPhase[name].push(p.p95Ms);
   }
   for(const key of ['observed','committed','rolledBack','sampled'])totals[key]+=worker[key];
   if(worker.truncated)totals.truncatedWorkers++;
  }
  return {scenario:scenario.scenario,workers:workers.length,transactions:totals,
   workerPhaseP95Ms:Object.fromEntries(phases.map(name=>[name,{minimum:byPhase[name].length?Math.min(...byPhase[name]):null,median:percentile(byPhase[name],.5),maximum:byPhase[name].length?Math.max(...byPhase[name]):null}])),
   interpretation:'Worker-level p95 distribution only; not a pooled transaction p95 or proof of lock contention.'};
 });
 return {format:'iway-transaction-diagnostic-summary',version:1,runId:typeof report.runId==='string'?report.runId:null,
  scope:'Opt-in local SQLite diagnostic evidence; not hosted capacity, production SLO, or performance certification',
  scenarios:summaries,certified:false,rootCauseEstablished:false,
  limitations:['Worker percentiles cannot be pooled into exact global percentiles','Acquire time includes SQLite BEGIN IMMEDIATE waiting and overhead; contention requires controlled comparison','No acceptance thresholds are modified']};
}
