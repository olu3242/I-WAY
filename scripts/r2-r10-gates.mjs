import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const gates=[
 ['R2','Cross-persona browser acceptance','tests/browser/operations.spec.mjs','CI evidence plus approved human QA'],
 ['R3','Identity, tenant isolation and authorization','docs/certification/r2-qa-persona-reconciliation-review-20261019.md','Independent security review and hosted RLS evidence'],
 ['R4','Operational PostgreSQL parity','scripts/certify-postgres.mjs','Hosted command coverage and tenant isolation results'],
 ['R5','Agentic runtime and governed handoffs','scripts/evaluate-operations.mjs','Durable agent execution, recovery and consent evidence'],
 ['R6','Tracking performance and reliability','scripts/operations-benchmark.mjs','Repeatable before/after p95 and throughput against approved SLO'],
 ['R7','Backup, restore and recovery','scripts/operations-recovery-rehearsal.mjs','Hosted RPO/RTO rehearsal and signed evidence'],
 ['R8','External integrations and payments','scripts/hosted-evidence.mjs','Authorized sandbox integrations and provider acceptance'],
 ['R9','Hosted release security and operations','docs/certification/hosted-execution-runbook.md','Trusted transport, hosted security and operational approval'],
 ['R10','Production release decision','scripts/operations-release-readiness.mjs','All prerequisites accepted plus explicit production approval']
];
export function evaluate(rootPath=root){
 return gates.map(([id,scope,path,remaining])=>({id,scope,path,sourcePresent:existsSync(resolve(rootPath,path)),status:'BLOCKED',remaining}));
}
export function report(rootPath=root){
 const results=evaluate(rootPath);
 return {schemaVersion:1,decision:'NO-GO',basis:'Source presence is not certification evidence; external approvals and hosted execution are not inferred.',gates:results};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=report();
 if(process.argv.includes('--json'))process.stdout.write(JSON.stringify(result,null,2)+'\n');
 else {for(const gate of result.gates)process.stdout.write(gate.id+' '+gate.status+' '+(gate.sourcePresent?'SOURCE PRESENT':'SOURCE MISSING')+' — '+gate.remaining+'\n');process.stdout.write('Decision: '+result.decision+'\n');}
 if(result.gates.some(g=>!g.sourcePresent))process.exitCode=1;
}
