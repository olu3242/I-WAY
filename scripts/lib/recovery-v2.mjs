// Recovery metadata only. Never returns COPY row contents or role passwords.
import {readFileSync, realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {win32, join} from 'node:path';
import {uatProject} from '../../server/operations-uat-target.mjs';
export {uatProject};
export const labId='IWAY-Recovery-Lab-V2';
export const cliVersion='2.122.0';
export const sha256=value=>createHash('sha256').update(value).digest('hex');
export const migrationNames=Object.freeze([
 '20261011055816_iway_early_access.sql','20261011060000_registration_role_prerequisites.sql',
 '20261011062148_registration_login.sql','20261011174100_operations_persistence_readiness.sql',
 '20261011210552_operations_active_principal_rls.sql','20261011220000_operations_actor_evidence.sql',
 '20261011221000_operations_dispatcher_directory.sql','20261011222000_operations_runtime_read_role.sql']);
export function assertLabPath(path){
 if(win32.resolve(path).replaceAll('\\','/').toLowerCase()!=='c:/iway-recovery-lab-v2')throw Error('EXACT_V2_PATH_REQUIRED');
 return win32.resolve(path);
}
export function assertLabContainer(metadata){
 if(metadata?.Name!=='/supabase_db_'+labId||metadata.Config?.Labels?.['com.supabase.cli.project']!==labId)throw Error('V2_CONTAINER_IDENTITY_REQUIRED');
 if(!['public.ecr.aws/supabase/postgres:17.11.0.006','sha256:c141fd17ac6a76c4323e90b3aee8ff1a23d2e89e547c2b963cfadc309c079cc2'].includes(metadata.Config.Image))throw Error('PINNED_POSTGRES_IMAGE_REQUIRED');
 return true;
}
export function backupManifest(directory){
 const root=realpathSync(directory);
 const csv=readFileSync(join(root,'recovery-hashes.csv'),'utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/).slice(1);
 const entries=csv.map(line=>{
  const m=/^"([a-z][a-z0-9-]*\.sql)","(\d+)","([a-fA-F0-9]{64})"$/.exec(line);
  if(!m)throw Error('BACKUP_MANIFEST_INVALID');
  const file=m[1],bytes=readFileSync(join(root,file));
  if(bytes.length!==Number(m[2])||sha256(bytes)!==m[3].toLowerCase())throw Error('BACKUP_INTEGRITY_FAILED');
  return {file,bytes:bytes.length,sha256:sha256(bytes)};
 });
 for(const file of ['roles.sql','schema.sql','data.sql'])if(!entries.some(e=>e.file===file))throw Error('BACKUP_FILE_UNBOUND');
 return entries;
}
export function copyInventory(sql){
 const lines=sql.split(/\r?\n/),result=[];
 for(let i=0;i<lines.length;i++){
  if(!lines[i].startsWith('COPY '))continue;
  const m=/^COPY "([a-z_][a-z0-9_]*)"\."([a-z_][a-z0-9_]*)" \((.+)\) FROM stdin;$/.exec(lines[i]);
  if(!m)throw Error('UNSUPPORTED_COPY_FORMAT');
  const columns=m[3].split(', ').map(x=>{if(!/^"[a-z0-9_]+"$/.test(x))throw Error('UNSUPPORTED_COLUMN');return x.slice(1,-1)});
  let rows=0;for(i++;i<lines.length&&lines[i]!=='\\.';i++)rows++;
  if(i===lines.length)throw Error('UNTERMINATED_COPY');
  result.push({schema:m[1],table:m[2],columns,rows});
 }
 if(!result.length)throw Error('COPY_DATA_REQUIRED');return result;
}
export function copyCompatibility(inventory,catalog){
 const absent=[];
 for(const t of inventory){const found=catalog.columns.filter(c=>c.schema===t.schema&&c.table===t.table);
  if(!found.length)absent.push(t.schema+'.'+t.table);
  else for(const column of t.columns)if(!found.some(c=>c.name===column))absent.push(t.schema+'.'+t.table+'.'+column);
 }
 return {status:absent.length?'BLOCKED_SCHEMA':'PASS_COPY_SHAPE',missing:absent};
}
export function migrationManifest(directory){
 return migrationNames.map(file=>{const raw=readFileSync(join(directory,file)),sql=raw.toString('utf8');return {file,sha256:sha256(raw),lfSha256:sha256(sql.replaceAll('\r\n','\n')),transaction:/^BEGIN;/m.test(sql)&&/COMMIT;\s*$/.test(sql)}});
}
export function safeRestoreError(stderr){
 // psql CONTEXT and DETAIL can contain dumped rows, tokens or SQL literals.
 // Persist only SQLSTATE, never the raw diagnostic.
 const state=/ERROR:\s+([0-9A-Z]{5}):/.exec(stderr)?.[1];
 return {code:'RESTORE_COMMAND_FAILED',sqlState:state??null,rawDiagnosticRetained:false};
}
export const catalogSql=`WITH t AS (
 SELECT c.oid,n.nspname,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) owner
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN ('auth','storage','public','iway_private','operations_private') AND c.relkind IN ('r','p','v','m')
), cols AS (
 SELECT t.nspname schema,t.relname "table",a.attname name,format_type(a.atttypid,a.atttypmod) type,a.attnotnull required,
 a.attgenerated generated FROM t JOIN pg_attribute a ON a.attrelid=t.oid WHERE a.attnum>0 AND NOT a.attisdropped
) SELECT json_build_object(
 'serverVersion',current_setting('server_version'),
 'tables',(SELECT coalesce(json_agg(x ORDER BY x.schema,x.name),'[]') FROM (SELECT nspname schema,relname name,relkind kind,relrowsecurity rls,relforcerowsecurity force_rls,owner FROM t)x),
 'columns',(SELECT coalesce(json_agg(cols ORDER BY schema,"table",name),'[]') FROM cols),
 'constraints',(SELECT coalesce(json_agg(x ORDER BY x.schema,x."table",x.name),'[]') FROM (SELECT t.nspname schema,t.relname "table",c.conname name,c.contype type,c.convalidated validated,pg_get_constraintdef(c.oid,true) definition FROM pg_constraint c JOIN t ON t.oid=c.conrelid)x),
 'policies',(SELECT coalesce(json_agg(x ORDER BY x.schemaname,x.tablename,x.policyname),'[]') FROM (SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname IN ('auth','storage','public','iway_private','operations_private'))x),
 'functions',(SELECT coalesce(json_agg(x ORDER BY x.schema,x.name,x.arguments),'[]') FROM (SELECT n.nspname schema,p.proname name,pg_get_function_identity_arguments(p.oid) arguments,pg_get_function_result(p.oid) result,p.prosecdef security_definer,md5(p.prosrc) body_hash FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('auth','storage'))x),
 'extensions',(SELECT json_agg(x ORDER BY x.name) FROM (SELECT e.extname name,e.extversion version,n.nspname schema FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace)x),
 'roles',(SELECT json_agg(x ORDER BY x.name) FROM (SELECT rolname name,rolsuper superuser,rolinherit inherit,rolcreaterole create_role,rolcreatedb create_db,rolcanlogin login,rolbypassrls bypass_rls FROM pg_roles WHERE rolname!~'^pg_')x)
 ) AS catalog;`;
export function compareCatalogs(source,target){
 const keys={tables:x=>x.schema+'.'+x.name,columns:x=>x.schema+'.'+x.table+'.'+x.name,constraints:x=>x.schema+'.'+x.table+'.'+x.name,policies:x=>x.schemaname+'.'+x.tablename+'.'+x.policyname,functions:x=>x.schema+'.'+x.name+'('+x.arguments+')',extensions:x=>x.name,roles:x=>x.name};
 return Object.fromEntries(Object.entries(keys).map(([kind,key])=>{
  const a=new Map((source[kind]??[]).map(x=>[key(x),x])),b=new Map((target[kind]??[]).map(x=>[key(x),x]));
  return [kind,{source:a.size,target:b.size,missing:[...a.keys()].filter(k=>!b.has(k)),extra:[...b.keys()].filter(k=>!a.has(k)),different:[...a.keys()].filter(k=>b.has(k)&&JSON.stringify(a.get(k))!==JSON.stringify(b.get(k)))}];
 }));
}
