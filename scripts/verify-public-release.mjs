import{readFileSync,lstatSync}from'node:fs';import{resolve,relative,isAbsolute}from'node:path';import{createHash}from'node:crypto';import{pathToFileURL}from'node:url';
export function verifyPublicTarget({target,artifactRoot}){
 if(target.schemaVersion!==1||target.referenceUrl!=='http://localhost:4174/early-access.html'||target.entry!=='early-access.html'||!/^([a-f0-9]{64})$/.test(target.entrySha256))throw Error('PUBLIC_TARGET_INVALID');
 const root=resolve(artifactRoot),entry=resolve(root,target.entry),rel=relative(root,entry);
 if(rel.startsWith('..')||isAbsolute(rel)||lstatSync(entry).isSymbolicLink()||!lstatSync(entry).isFile())throw Error('PUBLIC_TARGET_INVALID');
 const hash=createHash('sha256').update(readFileSync(entry)).digest('hex');
 if(hash!==target.entrySha256)throw Error('PUBLIC_TARGET_MISMATCH');
 return {status:'PASS',scope:'canonical entry file only',referenceUrl:target.referenceUrl,entry:target.entry,sha256:hash,deploymentExecuted:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{const target=JSON.parse(readFileSync(new URL('../docs/operations/PUBLIC_RELEASE_TARGET.json',import.meta.url),'utf8'));console.log(JSON.stringify(verifyPublicTarget({target,artifactRoot:process.argv[2]??target.sourceRoot})))}catch{console.error('PUBLIC_TARGET_BLOCKED: artifact does not match the user-selected canonical entry file.');process.exitCode=1}
}
