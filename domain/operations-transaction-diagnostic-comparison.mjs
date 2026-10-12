// Compares two independently captured opt-in diagnostic reports.
// Worker percentile changes are descriptive, not pooled transaction percentiles or certification.
import {summarizeTransactionDiagnostics} from './operations-transaction-diagnostic-summary.mjs';
const finite=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const change=(before,after)=>finite(before)&&finite(after)&&before>0?Math.round(((after/before)-1)*10000)/100:null;
export function compareTransactionDiagnostics(previous,current){
 const a=summarizeTransactionDiagnostics(previous),b=summarizeTransactionDiagnostics(current);
 if(!a.runId||!b.runId||a.runId===b.runId||JSON.stringify(previous.configuration)!==JSON.stringify(current.configuration))throw new TypeError('Distinct comparable diagnostic runs required');
 const first=new Map(a.scenarios.map(s=>[s.scenario,s]));
 const comparisons=b.scenarios.map(s=>{
  const prior=first.get(s.scenario);
  if(!prior||prior.workers!==s.workers)throw new TypeError('Worker configuration mismatch');
  const phases=Object.fromEntries(['acquireMs','executeMs','finalizeMs'].map(phase=>{
   const old=prior.workerPhaseP95Ms[phase],now=s.workerPhaseP95Ms[phase];
   return [phase,{previousMaximumWorkerP95Ms:old.maximum,currentMaximumWorkerP95Ms:now.maximum,changePercent:change(old.maximum,now.maximum)}];
  }));
  return {scenario:s.scenario,workers:s.workers,previousTransactions:prior.transactions.observed,currentTransactions:s.transactions.observed,
   previousRolledBack:prior.transactions.rolledBack,currentRolledBack:s.transactions.rolledBack,
   previousTruncatedWorkers:prior.transactions.truncatedWorkers,currentTruncatedWorkers:s.transactions.truncatedWorkers,
   phases};
 });
 return {format:'iway-transaction-diagnostic-comparison',version:1,previousRunId:a.runId,currentRunId:b.runId,
  scope:'Read-only local opt-in diagnostic comparison; no threshold changes or production capacity inference',
  scenarios:comparisons,certified:false,rootCauseEstablished:false,
  interpretation:'Changes in maximum worker p95 are descriptive; use controlled repeat runs before attributing contention.'};
}
