// Verification returns an approval-required plan. It cannot push or execute Vercel.
import {createHash} from 'node:crypto';
import {lstat,readdir,readFile} from 'node:fs/promises';
import {dirname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const projectId='prj_7uof3CdmN1QvzKxETkXvHjlrLjVm',orgId='team_zNHlJbJHa4YZFwN4p9lcHzEH';
const hash=body=>createHash('sha256').update(body).digest('hex');
export async function verifyUatStagingDelivery({directory,manifestPath=resolve(directory,'../iway-staging-manifest.json'),archivePath=resolve(directory,'../iway-staging-artifact.zip'),commit,env=process.env,target='preview'}={}){
 directory=resolve(directory);
 if(target!=='preview'||env.VERCEL_ENV&&env.VERCEL_ENV!=='preview'||env.VERCEL_TARGET_ENV&&env.VERCEL_TARGET_ENV!=='preview')throw Error('DELIVERY_PREVIEW_ONLY');
 if(env.VERCEL_PROJECT_ID&&env.VERCEL_PROJECT_ID!==projectId||env.VERCEL_ORG_ID&&env.VERCEL_ORG_ID!==orgId)throw Error('DELIVERY_PROJECT_BINDING_CONFLICT');
 if(!/^[0-9a-f]{40}$/.test(commit??''))throw Error('DELIVERY_EXACT_COMMIT_REQUIRED');
 const manifest=JSON.parse(await readFile(manifestPath));
 if(manifest.commit!==commit||manifest.projectId!==projectId||manifest.orgId!==orgId||manifest.target!=='preview'||manifest.source!=='committed-git-blobs'||manifest.automaticGitDeployment!==false)throw Error('DELIVERY_PROVENANCE_MISMATCH');
 const archive=await readFile(archivePath);if(hash(archive)!==manifest.archiveSha256)throw Error('DELIVERY_ARCHIVE_CHECKSUM_MISMATCH');
 const actual=[];
 async function inventory(path,prefix=''){
  if((await lstat(path)).isSymbolicLink())throw Error('DELIVERY_SYMLINK_REJECTED');
  for(const entry of await readdir(path,{withFileTypes:true})){
   const relative=prefix+entry.name,absolute=resolve(path,entry.name);
   if(!absolute.startsWith(directory+sep)||entry.isSymbolicLink())throw Error('DELIVERY_PATH_REJECTED');
   if(entry.isDirectory())await inventory(absolute,relative+'/');
   else if(entry.isFile())actual.push(relative);else throw Error('DELIVERY_NON_REGULAR_FILE');
  }
 }
 await inventory(directory);
 const expected=Object.keys(manifest.files??{}).sort();actual.sort();
 if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('DELIVERY_FILE_MANIFEST_MISMATCH');
 for(const path of expected){
  if(path.includes('\\')||path.split('/').some(part=>part==='..'||!part)||/^(?:docs|reference|site|node_modules)\/|(?:^|\/)\.env(?:\.|$)/.test(path))throw Error('DELIVERY_PRIVATE_FILE_REJECTED');
  const bytes=await readFile(resolve(directory,path)),entry=manifest.files[path];if(bytes.length!==entry.bytes||hash(bytes)!==entry.sha256)throw Error('DELIVERY_FILE_CHECKSUM_MISMATCH');
 }
 const binding=JSON.parse(await readFile(resolve(directory,'.vercel/project.json'))),config=JSON.parse(await readFile(resolve(directory,'vercel.json'))),provenance=JSON.parse(await readFile(resolve(directory,'artifact-provenance.json')));
 if(binding.projectId!==projectId||binding.orgId!==orgId||binding.projectName!=='iway-auth-staging'||config.git?.deploymentEnabled!==false||config.outputDirectory!=='public'||provenance.commit!==commit||provenance.projectId!==projectId||provenance.orgId!==orgId)throw Error('DELIVERY_ISOLATION_MISMATCH');
 return {status:'APPROVAL_REQUIRED',commit,artifactSha256:manifest.archiveSha256,projectId,orgId,target:'preview',workingDirectory:directory,fileCount:actual.length,gitPush:false,deployExecuted:false,requiredApproval:'Deploy this exact commit and checksum to the isolated staging project as a protected Preview after credentials, schemas, identities and external access are independently approved.',environment:{VERCEL_PROJECT_ID:projectId,VERCEL_ORG_ID:orgId}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const commit=process.argv[process.argv.indexOf('--commit')+1],directory=process.argv[process.argv.indexOf('--directory')+1];
 console.log(JSON.stringify(await verifyUatStagingDelivery({commit,directory}),null,2));
}
