// Offline evidence analysis. Explicit file arguments; no benchmark execution or calibration.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {comparePerformanceRuns} from '../domain/operations-performance-comparison.mjs';
async function main(args){
 if(args.length!==3&&args.length!==4)throw new Error('Usage: node scripts/operations-compare-performance.mjs INITIAL.json REPEAT.json BASELINE.json [OUTPUT.json]');
 const [initial,repeat,baseline]=await Promise.all(args.slice(0,3).map(async path=>JSON.parse(await readFile(resolve(path),'utf8'))));
 const result=comparePerformanceRuns(initial,repeat,baseline);
 if(args[3])await writeFile(resolve(args[3]),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify(result,null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main(process.argv.slice(2)).catch(error=>{console.error(JSON.stringify({status:'FAIL',reason:error instanceof SyntaxError?'INVALID_JSON':'INVALID_EVIDENCE_OR_PATH'}));process.exitCode=1;});
