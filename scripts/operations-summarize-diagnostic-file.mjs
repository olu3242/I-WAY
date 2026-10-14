// Read-only convenience CLI for an existing opt-in transaction diagnostic report.
// Does not modify certification evidence or change performance thresholds.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {summarizeTransactionDiagnostics} from '../domain/operations-transaction-diagnostic-summary.mjs';

export async function summarizeDiagnosticFile(args){
 if(args.length!==1&&args.length!==2)throw new TypeError('Expected diagnostic JSON path and optional new output path');
 const [source,destination]=args;
 const report=JSON.parse(await readFile(resolve(source),'utf8'));
 const summary=summarizeTransactionDiagnostics(report);
 if(destination)await writeFile(resolve(destination),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
 return summary;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 summarizeDiagnosticFile(process.argv.slice(2)).then(result=>console.log(JSON.stringify(result,null,2))).catch(()=>{
  console.error(JSON.stringify({status:'FAIL',reason:'INVALID_DIAGNOSTIC_OR_PATH'}));process.exitCode=1;
 });
}
