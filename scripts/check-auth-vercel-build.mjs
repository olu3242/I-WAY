import {X509Certificate} from 'node:crypto';
import {supabaseRootFingerprint} from '../server/postgres-tls.mjs';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export async function prepareLocalAuthBuild(directory){
 const root=resolve(directory);await mkdir(root+'/.vercel',{recursive:true});
 await writeFile(root+'/.vercel/project.json',JSON.stringify({projectId:'prj_7uof3CdmN1QvzKxETkXvHjlrLjVm',orgId:'team_zNHlJbJHa4YZFwN4p9lcHzEH',projectName:'iway-auth-staging',
  settings:{framework:null,nodeVersion:'24.x',buildCommand:null,installCommand:'npm ci --ignore-scripts --omit=dev',outputDirectory:'public',rootDirectory:null}},null,2));
 await writeFile(root+'/.vercel/.env.preview.local','IWAY_AUTH_ENABLED=false\n');
}
export async function verifyAuthBuild(directory){
 const output=resolve(directory,'.vercel/output');
 const config=JSON.parse(await readFile(output+'/config.json','utf8'));
 if(config.version!==3)throw Error('AUTH_BUILD_CONFIG_INVALID');
 for(const path of ['/api/health','/auth/login','/auth/callback','/auth/session','/auth/refresh','/auth/logout','/api/resources/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/verify']){
  const route=config.routes.find(r=>r.src&&new RegExp(r.src).test(path));
  if(route?.dest!=='/api/index'||route.status)throw Error('AUTH_BUILD_ROUTE_INVALID');
 }
 for(const path of ['/server/operations-auth-runtime.mjs','/domain/authorization.mjs','/api/index','/auth/debug','/docs/PRD.md']){
  if(config.routes.find(r=>r.src&&new RegExp(r.src).test(path))?.status!==404)throw Error('AUTH_BUILD_BOUNDARY_INVALID');
 }
 const staticFiles=await readdir(output+'/static');
 if(staticFiles.length!==1||staticFiles[0]!=='404.html')throw Error('AUTH_BUILD_SOURCE_EXPOSURE');
 const fn=JSON.parse(await readFile(output+'/functions/api/index.func/.vc-config.json','utf8'));
 if(fn.runtime!=='nodejs24.x'||fn.handler!=='api/index.mjs')throw Error('AUTH_BUILD_FUNCTION_INVALID');
 const certificatePath='server/certs/supabase-prod-ca-2021.crt';
 let certificate;
 try{certificate=await readFile(output+'/functions/api/index.func/'+certificatePath,'utf8');}
 catch(error){
  // Vercel FileFsRef assets may remain at source and be uploaded via filePathMap.
  if(error.code!=='ENOENT'||!['.vercel/output/shared/'+certificatePath,certificatePath].includes(fn.filePathMap?.[certificatePath]))throw Error('AUTH_BUILD_CERTIFICATE_MISSING');
  certificate=await readFile(resolve(directory,fn.filePathMap[certificatePath]),'utf8');
 }
 if(new X509Certificate(certificate).fingerprint256!==supabaseRootFingerprint)throw Error('AUTH_BUILD_CERTIFICATE_INVALID');
 return {runtime:fn.runtime,routes:7,staticFiles:1,backendSourcePublic:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const dir=process.argv[3]??'dist/auth-staging';
 if(process.argv[2]==='prepare')await prepareLocalAuthBuild(dir);
 else if(process.argv[2]==='verify')console.log(JSON.stringify(await verifyAuthBuild(dir)));
 else throw Error('Use prepare or verify with an artifact directory');
}
