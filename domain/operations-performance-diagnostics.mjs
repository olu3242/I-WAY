// Diagnostic-only interpretation of existing performance evidence.
// This module does not alter workloads, baselines, acceptance gates, or database settings.
const finite=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
export function diagnosePerformanceReport(report,baseline){
 if(report?.format!=='iway-performance-evidence'||!Array.isArray(report.scenarios))throw new TypeError('Invalid performance report');
 const budgets=new Map((baseline?.scenarios??[]).map(item=>[item.scenario,item.budgets]));
 const scenarios=report.scenarios.map(s=>{
  if(typeof s.scenario!=='string'||!finite(s.startupMs)||!finite(s.elapsedMs)||!finite(s.work)||!finite(s.throughputPerSecond))throw new TypeError('Invalid performance measurements');
  const budget=budgets.get(s.scenario);
  const expectedThroughput=s.elapsedMs>0?s.work*1000/s.elapsedMs:null;
  const throughputConsistent=expectedThroughput!==null&&Math.abs(expectedThroughput-s.throughputPerSecond)<Math.max(0.001,expectedThroughput*0.00001);
  const p95=s.latency?.p95Ms;
  const latencyPassed=budget&&finite(p95)&&finite(budget.p95Ms)?p95<=budget.p95Ms:null;
  const throughputPassed=budget&&finite(budget.minThroughputPerSecond)?s.throughputPerSecond>=budget.minThroughputPerSecond:null;
  return {scenario:s.scenario,workerStartupMs:s.startupMs,workElapsedMs:s.elapsedMs,observedWork:s.work,throughputPerSecond:s.throughputPerSecond,
   p95Ms:finite(p95)?p95:null,latencyPassed,throughputPassed,throughputConsistent,
   workerUserCpuMs:finite(s.resources?.workerUserCpuMs)?s.resources.workerUserCpuMs:null,
   workerSystemCpuMs:finite(s.resources?.workerSystemCpuMs)?s.resources.workerSystemCpuMs:null,
   warning:'Worker startup and CPU totals alone cannot identify SQLite lock contention or host-level saturation.'};
 });
 return {format:'iway-performance-diagnostics',version:1,runId:report.runId??null,configuration:report.configuration??null,
  scope:'Read-only interpretation of existing local evidence; no benchmark or certification modification',
  scenarios,allMeasurementsConsistent:scenarios.every(s=>s.throughputConsistent),
  conclusion:'Root cause not established. Transaction lock/commit timings and host metrics require separately approved instrumentation.'};
}
