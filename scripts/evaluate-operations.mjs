import {readFile,mkdir,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,relative} from 'node:path';
import {fixture} from '../tests/helpers/operations-fixture.mjs';
import {runOfflineEvaluation} from '../domain/operations-evaluation.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const paths=[
 ...await readdir(resolve(root,'domain')).then(names=>names.filter(name=>name.endsWith('.mjs')).map(name=>'domain/'+name)),
 'server/operations-store.mjs','server/operations-auth.mjs','tests/helpers/operations-fixture.mjs','scripts/evaluate-operations.mjs'
].sort();
const sha=content=>createHash('sha256').update(content).digest('hex');
try{
 const before=await Promise.all(paths.map(async path=>({path,sha256:sha(await readFile(resolve(root,path)))})));
 const evaluation=await runOfflineEvaluation({createFixture:fixture});
 const after=await Promise.all(paths.map(async path=>({path,sha256:sha(await readFile(resolve(root,path)))})));
 if(JSON.stringify(before)!==JSON.stringify(after))throw Object.assign(new Error('Sources changed during evaluation.'),{code:'SOURCE_CHANGED'});
 const artifact={...evaluation,sources:after,sourceDigest:sha(JSON.stringify(after)),runtime:{node:process.version,platform:process.platform},artifactKind:'offline-evaluation'};
 const output=resolve(root,'dist/operations-evidence/evaluation.json');
 await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(artifact,null,2)+'\n');
 console.log(JSON.stringify({status:artifact.localStatus,...artifact.summary,modelEvaluation:artifact.modelEvaluation.status,artifact:relative(root,output)}));
 if(artifact.localStatus!=='PASS')process.exitCode=1;
}catch(error){console.error(JSON.stringify({status:'FAIL',category:error?.code==='SOURCE_CHANGED'?'SOURCE_CHANGED':'EVALUATION_FAILURE',message:'Offline evaluation did not produce a valid evidence artifact.'}));process.exitCode=1;}
