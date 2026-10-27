// Explicit local-only runner. Supply verified portable binaries; no downloads or .env loading.
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,open,readFile,writeFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),output=resolve(root,process.argv[2]??'dist/b741-b760');
if(process.env.IWAY_POSTGRES17_LOCAL_OPT_IN!=='true')throw Error('POSTGRES17_DISPOSABLE_OPT_IN_REQUIRED');
if(!output.startsWith(resolve(root,'dist')+sep))throw Error('POSTGRES17_EVIDENCE_OUTPUT_REJECTED');
if(!process.env.IWAY_LOCAL_PG_BIN)throw Error('POSTGRES17_VERIFIED_BINARIES_REQUIRED');
const version=execFileSync(resolve(process.env.IWAY_LOCAL_PG_BIN,process.platform==='win32'?'postgres.exe':'postgres'),['--version'],{encoding:'utf8',windowsHide:true}).trim();
if(!/^postgres \(PostgreSQL\) 17\.[0-9]+$/.test(version))throw Error('POSTGRES17_BINARY_VERSION_REQUIRED');
await mkdir(output,{recursive:true});
const suites=[
 ['expense-lifecycle',['--test','tests/local/expenses.postgres.mjs'],{IWAY_EXPENSES_LOCAL_OPT_IN:'true'}],
 ['next-gap-closure',['--test','tests/local/next-gap-closure.postgres.mjs'],{IWAY_NEXT_GAP_LOCAL_OPT_IN:'true'}],
 ['figma-finance-offline',['--test','tests/local/figma-finance-offline.postgres.mjs'],{IWAY_FIGMA_LOCAL_OPT_IN:'true'}],
 ['auth',['scripts/test-auth-postgres-isolated.mjs'],{IWAY_AUTH_LOCAL_OPT_IN:'true'}],
 ['broker',['--test','tests/local/uat-postgres.test.mjs'],{IWAY_UAT_LOCAL_OPT_IN:'true'}],
 ['operations-contract',['--test','tests/local/operations-postgres.test.mjs'],{IWAY_OPERATIONS_LOCAL_OPT_IN:'1'}],
 ['durable-engine',['--test','tests/local/durable-operations-postgres.test.mjs'],{IWAY_DURABLE_LOCAL_OPT_IN:'true'}],
 ['broker-remediation',['--test','tests/b631-broker-remediation.postgres.mjs'],{IWAY_B631_LOCAL_OPT_IN:'true'}],
 ['management',['--test','tests/local/uat-management-postgres.test.mjs'],{IWAY_MANAGEMENT_LOCAL_OPT_IN:'true'}],
 ['staging-schema',['--test','tests/local/uat-staging-schema.postgres.mjs'],{IWAY_STAGING_SCHEMA_LOCAL_OPT_IN:'true'}]
];
const results=[];
for(const [name,args,optIn] of suites){
 const log=resolve(output,'postgres-'+name+'.log'),fd=await open(log,'w');let exitCode;
 try{exitCode=await new Promise((done,reject)=>{
  const child=spawn(process.execPath,args,{cwd:root,env:{...process.env,...optIn,IWAY_LOCAL_PG_MAJOR:'17',FORCE_COLOR:'0'},stdio:['ignore',fd.fd,fd.fd],windowsHide:true});
  child.once('error',reject);child.once('exit',done);
 });}finally{await fd.close();}
 const body=await readFile(log,'utf8'),count=label=>Number(new RegExp('(?:ℹ |# )'+label+' (\\d+)').exec(body)?.[1]??-1);
 // Each suite has one orchestration parent. Do not count that parent as a leaf scenario.
 const tests=count('tests'),pass=count('pass'),fail=count('fail'),skipped=count('skipped');
 const row={name,command:'node '+args.join(' '),exitCode,tests,pass,fail,skipped,orchestrationParents:1,leafScenarios:tests-1,log:log.slice(root.length).replaceAll('\\','/')};
 results.push(row);console.log(JSON.stringify(row));
 if(exitCode!==0||fail!==0||skipped!==0||tests<2)break;
}
const schemaLog=results.find(r=>r.name==='staging-schema');let schemaEvidence=null;
if(schemaLog){const body=await readFile(resolve(root,schemaLog.log),'utf8'),match=/STAGING_SCHEMA_EVIDENCE (\{[^\r\n]+\})/.exec(body);if(match)schemaEvidence=JSON.parse(match[1]);}
const complete=results.length===suites.length&&results.every(r=>r.exitCode===0&&r.fail===0&&r.skipped===0)&&schemaEvidence?.version?.number>=170000&&schemaEvidence.version.number<180000;
const report={schemaVersion:1,status:complete?'PASS':'FAIL',scope:'Disposable loopback PostgreSQL; synthetic data and providers only',binaryVersion:version,serverVersion:schemaEvidence?.version??null,suites:results,reportedNodeChecks:results.reduce((n,r)=>n+r.pass,0),leafScenarios:results.reduce((n,r)=>n+r.leafScenarios,0),schemaEvidence,hostedExecuted:false,productionParityClaimed:false,counting:'One orchestration parent per suite excluded from leafScenarios; cross-suite assertions may exercise the same security property. Browser and repository counts remain separate.'};
await writeFile(resolve(output,'postgres17-compatibility.json'),JSON.stringify(report,null,2)+'\n');
if(!complete)process.exitCode=1;
