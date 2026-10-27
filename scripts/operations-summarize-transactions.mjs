// Read-only CLI: summarizes an existing opt-in diagnostic report, never runs or certifies a benchmark.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {summarizeTransactionDiagnostics} from '../domain/operations-transaction-diagnostic-summary.mjs';

async function main(args){
 if(args.length!==1&&args.length!==2)throw new Error('Usage: node scripts/operations-summarize-transactions.mjs DIAGNOSTIC.json [NEW_SUMMARY.json]');
 const report=JSON.parse(await readFile(resolve(args[0]),'utf8'));
 const summary=summarizeTransactionDiagnostics(report);
 if(args[1])await writeFile(resolve(args[1]),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify(summary,null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 main(process.argv.slice(2)).catch(()=>{console.error(JSON.stringify({status:'FAIL',reason:'INVALID_DIAGNOSTIC_OR_PATH'}));process.exitCode=1;});
}
