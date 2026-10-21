// Explicit, allowlisted deploy artifact. Never copies docs, prototype, .env or marketing assets.
import {mkdir,readdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
export async function packageAuthStaging({source=resolve(dirname(fileURLToPath(import.meta.url)),'..'),output=resolve(source,'dist/auth-staging')}={}){
 source=resolve(source);output=resolve(output);
 await mkdir(output,{recursive:true});
 if((await readdir(output)).length)throw Error('PACKAGE_OUTPUT_MUST_BE_EMPTY');
 const files=new Set(['server/operations-auth-runtime.mjs']);
 async function collect(path){
  const text=await readFile(resolve(source,path),'utf8');
  for(const match of text.matchAll(/from ['"](\.[^'"]+)['"]/g)){
   const absolute=resolve(source,dirname(path),match[1]),relative=absolute.slice(source.length+1).replaceAll('\\','/');
   if(!absolute.startsWith(source+'/')&&!absolute.startsWith(source+'\\'))throw Error('PACKAGE_PATH_ESCAPE');
   if(!files.has(relative)){files.add(relative);await collect(relative);}
  }
 }
 await collect('server/operations-auth-runtime.mjs');
 files.add('server/certs/supabase-prod-ca-2021.crt');
 for(const path of files){await mkdir(dirname(resolve(output,path)),{recursive:true});await copyFile(resolve(source,path),resolve(output,path));}
 await mkdir(resolve(output,'api'),{recursive:true});
 await copyFile(resolve(source,'deploy/auth-staging/api/index.mjs'),resolve(output,'api/index.mjs'));
 await copyFile(resolve(source,'deploy/auth-staging/vercel.json'),resolve(output,'vercel.json'));
 const lock=JSON.parse(await readFile(resolve(source,'package-lock.json'),'utf8'));
 const pgVersion=lock.packages['node_modules/pg'].version;
 await writeFile(resolve(output,'package.json'),JSON.stringify({name:'iway-auth-staging',private:true,type:'module',engines:{node:'24.x'},dependencies:{pg:pgVersion}},null,2)+'\n');
 // Preserve exact transitive dependency integrity; omit development packages from installation.
 const subset={...lock,name:'iway-auth-staging',packages:{...lock.packages,'':{name:'iway-auth-staging',dependencies:{pg:pgVersion},engines:{node:'24.x'}}}};
 await writeFile(resolve(output,'package-lock.json'),JSON.stringify(subset,null,2)+'\n');
 return [...files].sort();
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 await packageAuthStaging();console.log('Prepared dist/auth-staging; deployment remains approval/configuration gated.');
}
