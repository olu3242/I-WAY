// Read-only comparison of two existing opt-in transaction diagnostic evidence files.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {compareTransactionDiagnostics} from '../domain/operations-transaction-diagnostic-comparison.mjs';

export async function compareTransactionDiagnosticFiles(args){
 if(args.length!==2&&args.length!==3)throw new TypeError('Expected two input reports and optional new output path');
 const [before,after]=await Promise.all(args.slice(0,2).map(async path=>JSON.parse(await readFile(resolve(path),'utf8'))));
 const result=compareTransactionDiagnostics(before,after);
 if(args[2])await writeFile(resolve(args[2]),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 compareTransactionDiagnosticFiles(process.argv.slice(2)).then(result=>console.log(JSON.stringify(result,null,2))).catch(()=>{
  console.error(JSON.stringify({status:'FAIL',reason:'INVALID_DIAGNOSTIC_OR_PATH'}));process.exitCode=1;
 });
}
