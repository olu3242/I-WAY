// Read-only assessment of independent local performance reports against the immutable baseline.
// This tool never converts failed runs into a passing certification.
const expected=['dispatch','workflow','documents','tenant_isolation'];
const positive=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
export function assessPerformanceSeries(reports,baseline){
 if(!Array.isArray(reports)||reports.length<3||baseline?.format!=='iway-performance-baseline'||baseline.version!==1)throw new TypeError('At least three reports and a measured baseline are required');
 const budgets=new Map((baseline.scenarios??[]).map(s=>[s.scenario,s.budgets]));
 if(budgets.size!==4||expected.some(s=>!budgets.has(s)))throw new TypeError('Incomplete baseline');
 const ids=new Set(),results=[];
 for(const report of reports){
  if(report?.format!=='iway-performance-evidence'||report.version!==1||report.diagnosticOnly===true||report.hostedCertified!==false||report.correctnessPassed!==true||!report.runId||ids.has(report.runId)||JSON.stringify(report.configuration)!==JSON.stringify(baseline.configuration)||!Array.isArray(report.scenarios)||report.scenarios.length!==4)throw new TypeError('Invalid, duplicated or noncomparable local report');
  ids.add(report.runId);
  const seen=new Set(),checks=[];
  for(const s of report.scenarios){
   if(!expected.includes(s.scenario)||seen.has(s.scenario)||!positive(s.throughputPerSecond)||!positive(s.elapsedMs)||!positive(s.resources?.maxWorkerRssBytes)||typeof s.latency?.p95Ms!=='number'||!Number.isFinite(s.latency.p95Ms)||s.latency.p95Ms<0||!s.invariants||!Object.values(s.invariants).length)throw new TypeError('Invalid scenario evidence');
   seen.add(s.scenario);
   const b=budgets.get(s.scenario);
   const check={scenario:s.scenario,throughputPassed:s.throughputPerSecond>=b.minThroughputPerSecond,latencyPassed:s.latency.p95Ms<=b.p95Ms,memoryPassed:s.resources.maxWorkerRssBytes<=b.maxWorkerRssBytes,errorsPassed:s.outcomes?.unexpectedError===0,invariantsPassed:Object.values(s.invariants).every(v=>v===true)};
   checks.push(check);
  }
  results.push({runId:report.runId,checks,passed:checks.every(c=>Object.entries(c).every(([k,v])=>k==='scenario'||v===true))});
 }
 const scenarios=expected.map(scenario=>{
  const values=reports.map(r=>r.scenarios.find(s=>s.scenario===scenario).throughputPerSecond);
  const passes=results.filter(r=>r.checks.find(c=>c.scenario===scenario).throughputPassed).length;
  return {scenario,minimumThroughputPerSecond:Math.min(...values),maximumThroughputPerSecond:Math.max(...values),throughputPasses:passes,throughputFailures:reports.length-passes,allRunsPassed:results.every(r=>Object.entries(r.checks.find(c=>c.scenario===scenario)).every(([k,v])=>k==='scenario'||v===true))};
 });
 return {format:'iway-performance-series-assessment',version:1,scope:'Read-only local regression evidence; not hosted certification or an SLO',runCount:reports.length,runIds:reports.map(r=>r.runId),scenarios,allRunsPassed:results.every(r=>r.passed),status:results.every(r=>r.passed)?'LOCAL_REPEAT_PASS':'LOCAL_REPEAT_FAIL',hostedCertified:false,certificationGranted:false};
}
