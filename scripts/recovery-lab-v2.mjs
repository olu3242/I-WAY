// Exact-target local lab tooling. No hosted mutation command is implemented here.
import {spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createServer} from 'node:net';
import {assertLabPath,assertLabContainer,labId,cliVersion,backupManifest,copyInventory,copyCompatibility,catalogSql,safeRestoreError} from './lib/recovery-v2.mjs';
const command=process.argv[2],lab=assertLabPath(process.env.IWAY_RECOVERY_LAB??'C:/IWAY-Recovery-Lab-V2');
const out=resolve(process.env.IWAY_RECOVERY_EVIDENCE??'dist/b902-b1000/recovery');mkdirSync(out,{recursive:true});
const cli=resolve(process.env.IWAY_RECOVERY_CLI??'dist/b902-b1000/tools/cli-2.122.0/supabase.exe');
function run(program,args,input){const r=spawnSync(program,args,{input,encoding:'utf8',maxBuffer:20*1024*1024,timeout:900000});if(r.status!==0){const e=Error('LOCAL_COMMAND_FAILED');e.safe={program:program==='docker'?'docker':'pinned-cli',exitCode:r.status,...safeRestoreError(r.stderr??'')};throw e}return r.stdout;}
const docker=(...args)=>run('docker',args);
function bound(){const m=JSON.parse(docker('inspect','supabase_db_'+labId))[0];assertLabContainer(m);return m;}
function sql(query){bound();const result=docker('exec','-i','supabase_db_'+labId,'psql','-X','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-c',query);return result.trim();}
function save(name,value){writeFileSync(join(out,name+'.json'),JSON.stringify(value,null,2)+'\n');return value;}
try{
 if(command==='init'){
  if(existsSync(lab))throw Error('V2_PATH_ALREADY_EXISTS');
  if(run(cli,['--version']).trim()!==cliVersion)throw Error('PINNED_CLI_REQUIRED');
  for(const port of [60420,60421,60422,60423,60424,60427,60429])await new Promise((ok,no)=>{const s=createServer();s.once('error',()=>no(Error('PORT_COLLISION')));s.listen(port,'0.0.0.0',()=>s.close(ok))});
  if(docker('ps','-a','--format','{{.Names}}').split(/\r?\n/).some(n=>n.endsWith('_'+labId)))throw Error('V2_RESOURCE_COLLISION');
  mkdirSync(lab);run(cli,['init','--workdir',lab]);
  const path=join(lab,'supabase/config.toml');let c=readFileSync(path,'utf8').replace(/^project_id = .*$/m,'project_id = "'+labId+'"');
  for(const [old,p] of [[54320,60420],[54321,60421],[54322,60422],[54323,60423],[54324,60424],[54327,60427],[54329,60429]])c=c.replaceAll(String(old),String(p));
  for(const section of ['db.seed','realtime','studio','analytics','edge_runtime','storage.vector']){const escaped=section.replaceAll('.','\\.');c=c.replace(new RegExp('(\\['+escaped+'\\][\\s\\S]*?enabled = )true'), '$1false')}
  c=c.replace(/(\[auth.mfa.totp\][\s\S]*?)(?=\n\[|$)/,block=>block.replaceAll('enabled = false','enabled = true'));
  writeFileSync(path,c);mkdirSync(join(lab,'supabase/.temp'),{recursive:true});writeFileSync(join(lab,'supabase/.temp/postgres-version'),'17.11.0.006');
  docker('network','create','--label','iway.recovery='+labId,'--opt','com.docker.network.bridge.host_binding_ipv4=127.0.0.1','iway-recovery-v2');
  save('provisioning',{status:'PREPARED',cliVersion,labId,ports:[60420,60421,60422,60423,60424,60427,60429],network:'iway-recovery-v2',hostBinding:'127.0.0.1',hostedMutation:false});
 }else if(command==='start'){
  if(readFileSync(join(lab,'supabase/config.toml'),'utf8').match(/^project_id = "([^"]+)"/m)?.[1]!==labId)throw Error('V2_CONFIG_REQUIRED');
  if(run(cli,['--version']).trim()!==cliVersion)throw Error('PINNED_CLI_REQUIRED');
  run(cli,['start','--workdir',lab,'--network-id','iway-recovery-v2','--exclude','realtime,studio,postgres-meta,edge-runtime,logflare,vector,supavisor,imgproxy']);
  run(process.execPath,['scripts/recovery-v2-loopback.mjs']);
  bound();const names=docker('ps','--format','{{.Names}}').trim().split(/\r?\n/).filter(n=>n.endsWith('_'+labId));
  const services=names.map(n=>{const m=JSON.parse(docker('inspect',n))[0];return {name:n,image:m.Config.Image,imageId:m.Image,health:m.State.Health?.Status??m.State.Status,bindings:m.HostConfig.PortBindings}});
  save('services',{status:services.every(s=>['healthy','running'].includes(s.health))?'PASS_HEALTH':'FAIL_HEALTH',services});
 }else if(command==='verify'){
  bound();const services=[];
  for(const role of ['db','auth','storage','rest','kong','inbucket']){
   const m=JSON.parse(docker('inspect','supabase_'+role+'_'+labId))[0];
   if(m.Config.Labels?.['com.supabase.cli.project']!==labId||!m.State.Running||m.State.Health&&m.State.Health.Status!=='healthy')throw Error('LOCAL_SERVICE_NOT_HEALTHY');
   const ports=Object.values(m.NetworkSettings.Ports??{}).flat().filter(Boolean);
   if(['db','kong','inbucket'].includes(role)&&(!ports.length||ports.some(p=>p.HostIp!=='127.0.0.1')))throw Error('ACTUAL_LOOPBACK_BINDING_REQUIRED');
   services.push({role,imageId:m.Image,health:m.State.Health?.Status??m.State.Status,bindings:m.NetworkSettings.Ports});
  }
  save('final-health',{status:'PASS_HEALTH_LOOPBACK',services,rawConfigurationRetained:false,originalLabModified:false});
 }else if(command==='catalog')save('local-catalog',JSON.parse(sql(catalogSql)));
 else if(command==='restore'){
  const backup=process.env.IWAY_RECOVERY_BACKUP;if(!backup)throw Error('BACKUP_PATH_REQUIRED');
  const manifest=backupManifest(backup),inventory=copyInventory(readFileSync(join(backup,'data.sql'),'utf8')),catalog=JSON.parse(sql(catalogSql));
  const compatibility=copyCompatibility(inventory,catalog);save('copy-compatibility',{...compatibility,tables:inventory});
  if(compatibility.missing.length)throw Error('MANAGED_SCHEMA_INCOMPATIBLE');
  // Empty managed data is required. No destructive truncation or replication bypass.
  for(const t of inventory)if(Number(sql('SELECT count(*) FROM "'+t.schema+'"."'+t.table+'"'))!==0)throw Error('RESTORE_REQUIRES_EMPTY_TABLES');
  const originalRoles=readFileSync(join(backup,'roles.sql'),'utf8');
  // Official Supabase documented local-only CLI login grant incompatibility.
  const roles=originalRoles.split(/\r?\n/).filter(s=>!/^GRANT "postgres" TO "cli_login_postgres" WITH INHERIT FALSE GRANTED BY "supabase_admin";$/.test(s)).join('\n');
  if(/CREATE ROLE "cli_login_postgres"/.test(roles)&&sql("SELECT count(*) FROM pg_roles WHERE rolname='cli_login_postgres'")!=='0')throw Error('ROLE_COLLISION');
  // Realtime is deliberately not started. Its managed NOLOGIN role is required
  // by the original parameter grant. Bootstrap only this inert role locally.
  const managedRole="DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='supabase_realtime_admin') THEN CREATE ROLE supabase_realtime_admin NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS; END IF; END $$;";
  const before=Date.now();
  bound();const input='BEGIN;\n'+managedRole+'\n'+roles+'\n'+readFileSync(join(backup,'schema.sql'),'utf8')+'\n'+readFileSync(join(backup,'data.sql'),'utf8')+'\nCOMMIT;\n';
  // Disposable recovery management identity only, never application traffic.
  run('docker',['exec','-i','supabase_db_'+labId,'psql','-X','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'],input);
  const counts=inventory.map(t=>({schema:t.schema,table:t.table,expected:t.rows,actual:Number(sql('SELECT count(*) FROM "'+t.schema+'"."'+t.table+'"'))}));
  if(counts.some(c=>c.expected!==c.actual))throw Error('RESTORE_COUNT_MISMATCH');
  save('restoration',{status:'PASS_LOGICAL_BACKUP_RESTORE_ONLY',durationMs:Date.now()-before,manifest,counts,transactional:true,triggersDisabled:false,localInertManagedRole:'supabase_realtime_admin',originalRoleGrantOmitted:roles!==originalRoles,fullManagedRecoveryCertified:false,externalStorageObjectsRestored:false});
  backupManifest(backup);
 }else throw Error('COMMAND_REQUIRED');
 console.log(JSON.stringify({command,status:'PASS_COMMAND',evidence:out}));
}catch(e){save('failure-'+command,{status:'FAIL',command,code:e.safe?.code??e.message,...(e.safe??{}),hostedMutation:false});console.error(JSON.stringify({command,status:'FAIL',code:e.safe?.code??e.message}));process.exitCode=1;}
