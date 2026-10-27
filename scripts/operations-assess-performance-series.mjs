import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {assessPerformanceSeries} from '../domain/operations-performance-series.mjs';

export async function assessPerformanceFiles(paths){
 if(!Array.isArray(paths)||paths.length<4)throw new TypeError('Usage: node scripts/operations-assess-performance-series.mjs BASELINE.json RUN1.json RUN2.json RUN3.json [RUN4.json ...]');
 const [baselinePath,...reportPaths]=paths;
 const [baseline,...reports]=await Promise.all([baselinePath,...reportPaths].map(async p=>JSON.parse(await readFile(resolve(p),'utf8'))));
 return assessPerformanceSeries(reports,baseline);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 assessPerformanceFiles(process.argv.slice(2)).then(result=>{
  console.log(JSON.stringify(result,null,2));
  if(result.status!=='LOCAL_REPEAT_PASS')process.exitCode=1;
 }).catch(()=>{console.error(JSON.stringify({status:'FAIL',reason:'INVALID_PERFORMANCE_SERIES_OR_PATH'}));process.exitCode=1});
}
