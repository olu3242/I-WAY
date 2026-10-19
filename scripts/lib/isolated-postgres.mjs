import {applyOperationsMigrations} from './operations-migrations.mjs';
// Explicit local fixture infrastructure. Never reads .env files or connects to an existing cluster.
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,existsSync,realpathSync,openSync,closeSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {randomBytes} from 'node:crypto';
import {createServer} from 'node:net';
import {Pool} from 'pg';
// Windows PostgreSQL descendants can inherit pipe handles after pg_ctl exits.
const run=(file,args,logPath)=>{
 const fd=logPath?openSync(logPath,'w',0o600):null;
 try{return execFileSync(file,args,{stdio:fd!==null?['ignore',fd,fd]:file==='whoami'?'pipe':'ignore',windowsHide:true,timeout:/initdb(?:\.exe)?$/i.test(file)?180000:60000})}finally{if(fd!==null)closeSync(fd)}
};
export async function isolatedPostgres({optIn=false,bin=process.env.IWAY_LOCAL_PG_BIN??'C:/Program Files/PostgreSQL/18/bin',openssl=process.env.IWAY_LOCAL_OPENSSL??'C:/Program Files/Git/usr/bin/openssl.exe'}={}){
 if(optIn!==true)throw Error('LOCAL_FIXTURE_OPT_IN_REQUIRED');
 for(const exe of ['initdb','pg_ctl'])if(!existsSync(join(bin,exe+(process.platform==='win32'?'.exe':''))))throw Error('LOCAL_POSTGRES_BINARIES_REQUIRED');
 if(!existsSync(openssl))throw Error('LOCAL_OPENSSL_REQUIRED');
 await new Promise((ok,no)=>{const s=createServer();s.once('error',()=>no(Error('LOCAL_FIXTURE_PORT_5433_UNAVAILABLE')));s.listen(5433,'127.0.0.1',()=>s.close(ok));});
 const base=realpathSync(tmpdir()),root=mkdtempSync(join(base,'iway-pg-fixture-')),data=join(root,'data'),password=randomBytes(32).toString('hex'),restrictedPassword=randomBytes(32).toString('hex');
 let started=false,admin;const pools=[];
 const cleanup=async()=>{
  await Promise.allSettled(pools.map(p=>p.end()));
  if(admin)await admin.end();
  if(started||existsSync(join(data,'postmaster.pid'))){run(join(bin,'pg_ctl'),['-D',data,'-m','immediate','-w','stop']);started=false;}
  const target=resolve(root);
  if(!target.startsWith(base+sep)||!target.slice(base.length+1).startsWith('iway-pg-fixture-'))throw Error('UNSAFE_FIXTURE_CLEANUP');
  rmSync(target,{recursive:true,force:true});
 };
 let stage='LOCAL_FIXTURE_INIT';
 try{
  if(process.platform==='win32'){
   stage='LOCAL_FIXTURE_ACCOUNT';
   const account=run('whoami',[]).toString().trim();
   stage='LOCAL_FIXTURE_ACL';
   run('icacls',[root,'/inheritance:r','/grant:r',account+':(OI)(CI)F','SYSTEM:(OI)(CI)F']);
  }
  writeFileSync(join(root,'password'),password,{mode:0o600});
  stage='LOCAL_FIXTURE_INITDB';
  run(join(bin,'initdb'),['-D',data,'-U','iway_fixture_admin','--pwfile='+join(root,'password'),'--auth=scram-sha-256','--encoding=UTF8','--no-locale'],join(root,'initdb.log'));
  rmSync(join(root,'password'));
  stage='LOCAL_FIXTURE_TLS_CA';
  writeFileSync(join(root,'openssl.cnf'),'[req]\ndistinguished_name=dn\n[dn]\n');
  run(openssl,['req','-config',join(root,'openssl.cnf'),'-x509','-newkey','rsa:2048','-nodes','-keyout',join(root,'ca.key'),'-out',join(root,'ca.crt'),'-days','1','-subj','/CN=I-way disposable local fixture CA','-addext','basicConstraints=critical,CA:TRUE','-addext','keyUsage=critical,keyCertSign,cRLSign']);
  stage='LOCAL_FIXTURE_TLS_CSR';
  run(openssl,['req','-config',join(root,'openssl.cnf'),'-newkey','rsa:2048','-nodes','-keyout',join(data,'server.key'),'-out',join(root,'server.csr'),'-subj','/CN=localhost']);
  writeFileSync(join(root,'extensions'),'subjectAltName=DNS:localhost,IP:127.0.0.1\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n');
  stage='LOCAL_FIXTURE_TLS_SIGN';
  run(openssl,['x509','-req','-in',join(root,'server.csr'),'-CA',join(root,'ca.crt'),'-CAkey',join(root,'ca.key'),'-CAcreateserial','-out',join(data,'server.crt'),'-days','1','-extfile',join(root,'extensions')]);
  writeFileSync(join(data,'pg_hba.conf'),'hostssl all all 127.0.0.1/32 scram-sha-256\nhost all all 0.0.0.0/0 reject\nhost all all ::0/0 reject\n');
  writeFileSync(join(data,'postgresql.auto.conf'),"listen_addresses='127.0.0.1'\nport=5433\nunix_socket_directories='${root}'\nssl=on\nssl_min_protocol_version='TLSv1.2'\nlog_statement='none'\nlog_min_error_statement='panic'\n");
  stage='LOCAL_FIXTURE_START';
  run(join(bin,'pg_ctl'),['-D',data,'-l',join(root,'server.log'),'-w','start']);started=true;
  const ssl={ca:readFileSync(join(root,'ca.crt'),'utf8'),rejectUnauthorized:true,minVersion:'TLSv1.2'};
  const common={host:'127.0.0.1',port:5433,ssl,connectionTimeoutMillis:5000,max:6};
  admin=new Pool({...common,user:'iway_fixture_admin',password,database:'postgres'});
  stage='LOCAL_FIXTURE_SCHEMA';
  await admin.query('CREATE DATABASE iway_fixture');
  await admin.end();admin=new Pool({...common,user:'iway_fixture_admin',password,database:'iway_fixture'});
  // Password originates only from randomBytes hex above, not input. No credentials reach command arguments/logs.
  await admin.query("CREATE ROLE iway_operations_fixture LOGIN PASSWORD '"+restrictedPassword+"' NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION");
  await applyOperationsMigrations(admin);
  await admin.query('GRANT USAGE ON SCHEMA operations_private TO iway_operations_fixture');
  await admin.query('GRANT SELECT ON operations_private.tenants,operations_private.users,operations_private.dispatcher_directory TO iway_operations_fixture');
  await admin.query('GRANT SELECT,INSERT,UPDATE ON operations_private.resources,operations_private.sessions TO iway_operations_fixture');
  await admin.query('GRANT SELECT,INSERT ON operations_private.commands,operations_private.audit TO iway_operations_fixture');
  await admin.query('GRANT USAGE ON ALL SEQUENCES IN SCHEMA operations_private TO iway_operations_fixture');
  const restricted={...common,user:'iway_operations_fixture',password:restrictedPassword,database:'iway_fixture'};
  const pool=new Pool(restricted);pools.push(pool);
  return {admin,pool,ssl,restricted,caPath:join(root,'ca.crt'),createPool(options={}){const p=new Pool({...restricted,...options});pools.push(p);return p},cleanup};
 }catch(error){
  let diagnostic='';
  if(stage==='LOCAL_FIXTURE_INITDB'&&existsSync(join(root,'initdb.log')))diagnostic=readFileSync(join(root,'initdb.log'),'utf8').slice(-700).replaceAll(root,'[fixture]').replaceAll(password,'[redacted]');
  if(stage==='LOCAL_FIXTURE_START'&&existsSync(join(root,'server.log')))diagnostic=readFileSync(join(root,'server.log'),'utf8').split(/\r?\n/).filter(line=>/FATAL|could not|Permission denied/i.test(line)).slice(-5).join(' ').replaceAll(root,'[fixture]').replaceAll(password,'[redacted]').replaceAll(restrictedPassword,'[redacted]');
  try{await cleanup()}catch{}throw Error(stage+'_FAILED'+(error?.code==='ETIMEDOUT'?'_TIMEOUT':'')+(diagnostic?': '+diagnostic:''));
 }
}
