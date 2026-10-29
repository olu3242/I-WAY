// Recreate only this task's V2 published containers. Retain stopped originals
// and every named volume for rollback. Docker configuration stays in memory.
import http from 'node:http';
import {writeFileSync,mkdirSync} from 'node:fs';
import {labId} from './lib/recovery-v2.mjs';
const pipe=String.raw`\\.\pipe\dockerDesktopLinuxEngine`;
function api(method,path,body,binary=false){return new Promise((resolve,reject)=>{
 const bytes=body===undefined?undefined:Buffer.isBuffer(body)?body:Buffer.from(JSON.stringify(body));
 const q=http.request({socketPath:pipe,method,path,headers:bytes?{'content-type':Buffer.isBuffer(body)?'application/x-tar':'application/json','content-length':bytes.length}:{}},r=>{const b=[];r.on('data',x=>b.push(x));r.on('end',()=>{if(r.statusCode>=300){reject(Error('DOCKER_API_'+r.statusCode));return}const value=Buffer.concat(b);resolve(binary?value:value.length?JSON.parse(value.toString()):null)})});q.on('error',()=>reject(Error('DOCKER_PIPE_UNAVAILABLE')));q.end(bytes);
});}
async function copyGatewayConfiguration(source,destination){
 // CLI-generated local gateway configuration and local TLS material. Transfer
 // directly between V2 containers in memory; never write to repo/logs/artifacts.
 for(const file of ['kong.yml','localhost.crt','localhost.key']){
  const archive=await api('GET','/containers/'+source+'/archive?path=/home/kong/'+file,undefined,true);
  await api('PUT','/containers/'+destination+'/archive?path=/home/kong',archive);
 }
}
const evidence=[];
try{
 for(const service of ['db','kong','inbucket','auth']){
  const name='supabase_'+service+'_'+labId,old=await api('GET','/containers/'+name+'/json');
  if(old.Name!=='/'+name||old.Config.Labels?.['com.supabase.cli.project']!==labId)throw Error('V2_IDENTITY_REQUIRED');
  const ports=Object.values(old.HostConfig.PortBindings??{}).flat().filter(Boolean);
  const mfaKeys=['GOTRUE_MFA_TOTP_ENROLL_ENABLED','GOTRUE_MFA_TOTP_VERIFY_ENABLED'];
  const localMfaReady=service==='auth'&&mfaKeys.every(key=>old.Config.Env.includes(key+'=true'));
  if(service==='auth'?localMfaReady:ports.length&&ports.every(p=>p.HostIp==='127.0.0.1')){
   if(service==='kong'&&!Object.keys(old.NetworkSettings.Ports??{}).length){
    const retained=await api('GET','/containers/'+name+'-before-loopback/json');
    if(retained.Config.Labels?.['com.supabase.cli.project']!==labId)throw Error('V2_GATEWAY_BACKUP_REQUIRED');
    await copyGatewayConfiguration(retained.Id,old.Id);await api('POST','/containers/'+old.Id+'/restart?t=10');
   }
   evidence.push({name,status:service==='auth'?'ALREADY_LOCAL_MFA':'ALREADY_LOOPBACK'});continue;
  }
  const backupName=name+'-before-loopback';
  const bindings=structuredClone(old.HostConfig.PortBindings);
  for(const values of Object.values(bindings??{}))for(const p of values)p.HostIp='127.0.0.1';
  const config=structuredClone(old.Config);
  if(service==='auth')config.Env=[...config.Env.filter(value=>!mfaKeys.some(key=>value.startsWith(key+'='))),...mfaKeys.map(key=>key+'=true')];
  let created=null,renamed=false;
  try{
   await api('POST','/containers/'+old.Id+'/stop?t=30');
   await api('POST','/containers/'+old.Id+'/rename?name='+backupName);renamed=true;
   const endpoints=Object.fromEntries(Object.entries(old.NetworkSettings.Networks).map(([n,v])=>[n,{Aliases:(v.Aliases??[]).filter(x=>!/^[a-f0-9]{12,64}$/.test(x))}]));
   created=await api('POST','/containers/create?name='+name,{...config,Image:old.Image,HostConfig:{...old.HostConfig,PortBindings:bindings},NetworkingConfig:{EndpointsConfig:endpoints}});
   if(service==='kong')await copyGatewayConfiguration(old.Id,created.Id);
   await api('POST','/containers/'+created.Id+'/start');
   const current=await api('GET','/containers/'+created.Id+'/json');
   if(!current.State.Running||Object.values(current.NetworkSettings.Ports??{}).flat().filter(Boolean).some(p=>p.HostIp!=='127.0.0.1'))throw Error('LOOPBACK_VERIFICATION_FAILED');
   evidence.push({name,status:service==='auth'?'PASS_LOCAL_MFA_CONFIG':'PASS_LOOPBACK',imageId:old.Image,bindings:current.NetworkSettings.Ports,retainedStoppedContainer:backupName,volumesPreserved:true});
  }catch(error){
   // Roll back names and start the retained original. Never remove a volume.
   if(created){await api('POST','/containers/'+created.Id+'/stop?t=10').catch(()=>{});await api('DELETE','/containers/'+created.Id).catch(()=>{});}
   if(renamed)await api('POST','/containers/'+old.Id+'/rename?name='+name).catch(()=>{});
   await api('POST','/containers/'+old.Id+'/start').catch(()=>{});throw error;
  }
 }
 mkdirSync('dist/b902-b1000/recovery',{recursive:true});writeFileSync('dist/b902-b1000/recovery/loopback.json',JSON.stringify({status:'PASS',evidence,originalLabModified:false,configSecretsPersisted:false},null,2));console.log(JSON.stringify({status:'PASS_LOOPBACK',containers:evidence.length}));
}catch(e){console.error(JSON.stringify({status:'FAIL_LOOPBACK',code:/^[A-Z0-9_]+$/.test(e.message)?e.message:'LOCAL_REBIND_FAILED'}));process.exitCode=1;}
