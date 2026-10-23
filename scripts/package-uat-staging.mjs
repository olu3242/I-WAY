// Local packaging only. No push, Vercel CLI, credential loading or deployment.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,readdir,lstat,writeFile} from 'node:fs/promises';
import {dirname,isAbsolute,posix,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const projectId='prj_7uof3CdmN1QvzKxETkXvHjlrLjVm';
const orgId='team_zNHlJbJHa4YZFwN4p9lcHzEH';
const assets=['admin.html','admin.js','extended.js','i-way-logo.svg','index.html','intelligence.js','login.html','login.js','ops.css','ops.js'];
const intelligence=['lib/intelligence/policy-lifecycle.mjs','lib/intelligence/decision-plane.mjs'];
const sha256=value=>createHash('sha256').update(value).digest('hex');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function git(source,args,encoding='utf8'){return execFileSync('git',args,{cwd:source,encoding,maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe']});}
function safePath(value){
 if(typeof value!=='string'||!value||value.includes('\\')||isAbsolute(value)||value.split('/').some(part=>part==='..'||!part)||/[\x00-\x1f]/.test(value))throw Error('PACKAGE_PATH_REJECTED');
 return value;
}
function allowSource(path){
 safePath(path);
 if(!/^(?:server|domain)\/[A-Za-z0-9_./-]+\.(?:mjs|crt)$/.test(path)&&!assets.some(name=>path==='apps/operations/'+name)&&![...intelligence,'deploy/uat-staging/api/index.mjs','deploy/uat-staging/vercel.json','package-lock.json'].includes(path))throw Error('PACKAGE_SOURCE_NOT_ALLOWLISTED');
}
async function assertOutput(source,output){
 const prefix=resolve(source,'dist')+sep;
 if(!output.startsWith(prefix))throw Error('PACKAGE_OUTPUT_OUTSIDE_DIST');
 for(let current=output;current!==source;current=dirname(current)){
  try{if((await lstat(current)).isSymbolicLink())throw Error('PACKAGE_OUTPUT_SYMLINK');}catch(error){if(error.code!=='ENOENT')throw error;}
 }
}
function dependencySubset(lock){
 if(lock.lockfileVersion!==3||!lock.packages?.['node_modules/pg'])throw Error('PACKAGE_PG_LOCK_REQUIRED');
 const version=lock.packages['node_modules/pg'].version;
 if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('PACKAGE_PG_VERSION_INVALID');
 const manifest={name:'iway-uat-staging',private:true,type:'module',engines:{node:'24.x'},dependencies:{pg:version}};
 const packages={'':{name:manifest.name,engines:manifest.engines,dependencies:manifest.dependencies}};
 function collect(path){
  if(packages[path])return;
  const entry=lock.packages[path];
  if(!entry||entry.dev||entry.link||entry.hasInstallScript||!/^sha512-[A-Za-z0-9+/=]+$/.test(entry.integrity)||!entry.resolved?.startsWith('https://registry.npmjs.org/'))throw Error('PACKAGE_DEPENDENCY_NOT_REVIEWED');
  packages[path]=entry;
  for(const name of Object.keys({...entry.dependencies,...entry.optionalDependencies}).sort()){
   const nested=path+'/node_modules/'+name,flat='node_modules/'+name;
   collect(lock.packages[nested]?nested:flat);
  }
 }
 collect('node_modules/pg');
 return {manifest,lock:{name:manifest.name,lockfileVersion:3,requires:true,packages:Object.fromEntries(Object.entries(packages).sort(([a],[b])=>a.localeCompare(b,'en')))}};
}
const json=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
// ZIP STORE with fixed timestamps and sorted filenames: identical Git blobs yield identical bytes.
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
export function deterministicZip(files){
 const chunks=[],central=[];let offset=0;
 for(const [path,body] of [...files].sort(([a],[b])=>a<b?-1:a>b?1:0)){
  safePath(path);const name=Buffer.from(path),crc=crc32(body);
  if(body.length>=0xffffffff||offset>=0xffffffff)throw Error('PACKAGE_ZIP_TOO_LARGE');
  const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt16LE(33,12);local.writeUInt32LE(crc,14);local.writeUInt32LE(body.length,18);local.writeUInt32LE(body.length,22);local.writeUInt16LE(name.length,26);
  chunks.push(local,name,body);
  const record=Buffer.alloc(46);record.writeUInt32LE(0x02014b50);record.writeUInt16LE(0x314,4);record.writeUInt16LE(20,6);record.writeUInt16LE(0x800,8);record.writeUInt16LE(33,14);record.writeUInt32LE(crc,16);record.writeUInt32LE(body.length,20);record.writeUInt32LE(body.length,24);record.writeUInt16LE(name.length,28);record.writeUInt32LE((0o100644<<16)>>>0,38);record.writeUInt32LE(offset,42);central.push(record,name);
  offset+=local.length+name.length+body.length;
 }
 const index=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.size,8);end.writeUInt16LE(files.size,10);end.writeUInt32LE(index.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...chunks,index,end]);
}
export async function packageUatStaging({source=root,output=resolve(source,'dist/b661-b680/staging'),commit}={}){
 source=resolve(source);output=resolve(output);await assertOutput(source,output);
 if(!/^[0-9a-f]{40}$/.test(commit??''))throw Error('PACKAGE_EXACT_COMMIT_REQUIRED');
 if(git(source,['rev-parse','HEAD']).trim()!==commit)throw Error('PACKAGE_HEAD_MISMATCH');
 if(git(source,['status','--porcelain','--untracked-files=normal']).trim())throw Error('PACKAGE_CLEAN_WORKTREE_REQUIRED');
 const entries=new Map(git(source,['ls-tree','-rz',commit]).split('\0').filter(Boolean).map(line=>{const [metadata,path]=line.split('\t');const [mode,type,oid]=metadata.split(' ');return [path,{mode,type,oid}];}));
 const sourceFiles=new Map(),files=new Map(),bare=new Set();
 function blob(path){
  allowSource(path);const entry=entries.get(path);
  if(!entry||entry.type!=='blob'||!['100644','100755'].includes(entry.mode))throw Error('PACKAGE_COMMITTED_REGULAR_FILE_REQUIRED');
  const bytes=git(source,['cat-file','blob',entry.oid],null);sourceFiles.set(path,{gitBlob:entry.oid,sha256:sha256(bytes),bytes:bytes.length});return bytes;
 }
 function dependency(path,specifier){
  if(specifier.startsWith('node:'))return;
  if(!specifier.startsWith('.')){if(specifier!=='pg')throw Error('PACKAGE_BARE_DEPENDENCY_NOT_ALLOWLISTED');bare.add(specifier);return;}
  collect(posix.normalize(posix.join(posix.dirname(path),specifier)));
 }
 function collect(path){
  if(files.has(path))return;
  const bytes=blob(path);files.set(path,bytes);if(!/\.mjs$/.test(path))return;
  const text=bytes.toString('utf8');
  for(const match of text.matchAll(/(?:^|[;\n])\s*(?:import|export)\s*(?:[\w$*{},\s]+?\s*from\s*)?(['"])([^'"\r\n]+)\1/g))dependency(path,match[2]);
  for(const match of text.matchAll(/\bimport\s*\(([^)]*)\)/g)){
   const literal=match[1].trim().match(/^(['"])([^'"\r\n]+)\1$/);if(!literal)throw Error('PACKAGE_NON_LITERAL_IMPORT_REJECTED');dependency(path,literal[2]);
  }
  for(const match of text.matchAll(/new URL\(\s*(['"])(\.[^'"]+)\1\s*,\s*import\.meta\.url\s*\)/g))collect(posix.normalize(posix.join(posix.dirname(path),match[2])));
 }
 collect('deploy/uat-staging/api/index.mjs');
 for(const asset of assets)collect('apps/operations/'+asset);
 collect('server/certs/supabase-prod-ca-2021.crt');
 // Retain committed source paths; the generated Vercel adapter is the only wrapper.
 files.set('api/index.mjs',Buffer.from("export {default,config} from '../deploy/uat-staging/api/index.mjs';\n"));
 const config=JSON.parse(blob('deploy/uat-staging/vercel.json'));
 if(config.framework!==null||config.outputDirectory!=='public'||config.git?.deploymentEnabled!==false||config.functions?.['api/index.mjs']?.includeFiles!=='{server,domain,lib/intelligence,apps/operations}/**')throw Error('PACKAGE_VERCEL_ISOLATION_REQUIRED');
 files.set('vercel.json',json(config));
 const subset=dependencySubset(JSON.parse(blob('package-lock.json')));
 if(!bare.has('pg'))throw Error('PACKAGE_PG_RUNTIME_NOT_REACHED');
 files.set('package.json',json(subset.manifest));files.set('package-lock.json',json(subset.lock));
 files.set('.vercel/project.json',json({projectId,orgId,projectName:'iway-auth-staging'}));
 files.set('public/404.html',Buffer.from('<!doctype html><html lang="en"><meta charset="utf-8"><title>Not found</title><h1>Not found</h1></html>\n'));
 const provenance={version:1,commit,projectId,orgId,target:'preview',source:'committed-git-blobs',automaticGitDeployment:false,sourceFiles:Object.fromEntries([...sourceFiles].sort(([a],[b])=>a<b?-1:1))};
 files.set('artifact-provenance.json',json(provenance));
 const archive=deterministicZip(files),manifest={...provenance,archive:'iway-staging-artifact.zip',archiveSha256:sha256(archive),dependencies:{pg:subset.manifest.dependencies.pg,lockedPackages:Object.keys(subset.lock.packages).filter(Boolean)},files:Object.fromEntries([...files].sort(([a],[b])=>a<b?-1:1).map(([path,body])=>[path,{sha256:sha256(body),bytes:body.length}]))};
 // Check again before writing: concurrent edits cannot be mislabeled as a clean source.
 if(git(source,['rev-parse','HEAD']).trim()!==commit||git(source,['status','--porcelain','--untracked-files=normal']).trim())throw Error('PACKAGE_SOURCE_CHANGED_DURING_BUILD');
 await mkdir(output,{recursive:true});if((await readdir(output)).length)throw Error('PACKAGE_OUTPUT_MUST_BE_EMPTY');
 for(const [path,body] of files){await mkdir(dirname(resolve(output,path)),{recursive:true});await writeFile(resolve(output,path),body,{flag:'wx'});}
 await writeFile(resolve(output,'..','iway-staging-artifact.zip'),archive,{flag:'wx'});
 await writeFile(resolve(output,'..','iway-staging-manifest.json'),json(manifest),{flag:'wx'});
 return manifest;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const commit=process.argv[process.argv.indexOf('--commit')+1];
 const manifest=await packageUatStaging({commit});console.log(JSON.stringify({commit:manifest.commit,archiveSha256:manifest.archiveSha256,fileCount:Object.keys(manifest.files).length,target:manifest.target,projectId:manifest.projectId}));
}
