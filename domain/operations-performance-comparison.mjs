// Comparison of immutable local benchmark evidence. Never changes acceptance budgets.
import {diagnosePerformanceReport} from './operations-performance-diagnostics.mjs';
const number=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
export function comparePerformanceRuns(previous,current,baseline){
 const before=diagnosePerformanceReport(previous,baseline);
 const after=diagnosePerformanceReport(current,baseline);
 if(JSON.stringify(previous.configuration)!==JSON.stringify(current.configuration))throw new TypeError('Benchmark workloads differ');
 const old=new Map(before.scenarios.map(s=>[s.scenario,s]));
 if(old.size!==before.scenarios.length||new Set(after.scenarios.map(s=>s.scenario)).size!==after.scenarios.length||old.size!==after.scenarios.length)throw new TypeError('Scenario sets differ');
 const scenarios=after.scenarios.map(s=>{
  const first=old.get(s.scenario);if(!first)throw new TypeError('Scenario sets differ');
  const delta=(a,b)=>number(a)&&number(b)&&a!==0?Math.round((b/a-1)*10000)/100:null;
  return {scenario:s.scenario,initialThroughputPerSecond:first.throughputPerSecond,repeatThroughputPerSecond:s.throughputPerSecond,
   throughputChangePercent:delta(first.throughputPerSecond,s.throughputPerSecond),
   initialP95Ms:first.p95Ms,repeatP95Ms:s.p95Ms,p95ChangePercent:delta(first.p95Ms,s.p95Ms),
   initialStartupMs:first.workerStartupMs,repeatStartupMs:s.workerStartupMs,
   initialWorkElapsedMs:first.workElapsedMs,repeatWorkElapsedMs:s.workElapsedMs,
   repeatLatencyPassed:s.latencyPassed,repeatThroughputPassed:s.throughputPassed,
   throughputEvidenceConsistent:first.throughputConsistent&&s.throughputConsistent};
 });
 return {format:'iway-performance-comparison',version:1,scope:'Local evidence comparison only; does not change benchmark thresholds',
  previousRunId:before.runId,currentRunId:after.runId,configuration:after.configuration,
  scenarios,allThroughputRegressed:scenarios.every(s=>s.throughputChangePercent!==null&&s.throughputChangePercent<0),
  certified:false,rootCauseEstablished:false};
}
