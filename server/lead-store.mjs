import {mkdir,open,readFile,rename,rm} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export function normalizeLead(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid request');
 const name=String(input.name??'').trim().slice(0,120);
 const email=String(input.email??'').trim().toLowerCase();
 const company=String(input.company??'').trim().slice(0,120);
 const role=String(input.role??'').trim();
 if(name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!['driver','carrier','fleet','other'].includes(role)||input.consent!==true)throw new Error('Invalid registration fields');
 return {name,email,company,role,consent:true};
}
export async function registerLead(path,input){
 const lead=normalizeLead(input);await mkdir(dirname(path),{recursive:true});
 let lock;const lockPath=path+'.lock';
 for(let i=0;i<40;i++){try{lock=await open(lockPath,'wx');break}catch(e){if(e.code!=='EEXIST')throw e;await sleep(25)}}
 if(!lock)throw new Error('Registration temporarily unavailable');
 try{
  let rows=[];try{rows=JSON.parse(await readFile(path,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
  const hash=createHash('sha256').update(lead.email).digest('hex');
  if(rows.some(x=>x.emailHash===hash))return {created:false};
  rows.push({...lead,id:randomUUID(),emailHash:hash,createdAt:new Date().toISOString()});
  const temp=path+'.'+randomUUID()+'.tmp';
  try{const f=await open(temp,'wx',0o600);try{await f.writeFile(JSON.stringify(rows));await f.sync()}finally{await f.close()}await rename(temp,path)}finally{await rm(temp,{force:true})}
  return {created:true};
 }finally{await lock.close();await rm(lockPath,{force:true})}
}
