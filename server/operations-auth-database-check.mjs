import {authColumns} from './operations-auth-schema-contract.mjs';
const tables=Object.keys(authColumns);
const normalize=value=>value?.replace(/[\s()]/g,'').toLowerCase();
const policies={
 auth_runtime_pkce:{table:'auth_pkce_transactions',command:'*',using:'true',check:'true'},
 auth_runtime_sessions:{table:'auth_server_sessions',command:'*',using:'true',check:'true'},
 auth_runtime_roles:{table:'auth_tenant_roles',command:'r',using:"user_id = NULLIF(current_setting('iway.user_id'::text, true), ''::text)::uuid AND active AND revoked_at IS NULL",check:null},
 auth_runtime_tenants:{table:'auth_tenants',command:'r',using:'active AND EXISTS SELECT 1 FROM iway_private.auth_tenant_roles m WHERE m.tenant_id = auth_tenants.tenant_id',check:null},
 auth_runtime_resources:{table:'auth_resources',command:'r',using:'active AND EXISTS SELECT 1 FROM iway_private.auth_tenants t WHERE t.tenant_id = auth_resources.tenant_id',check:null}
};
export async function assertAuthDatabaseReady({query}){
 const fail=()=>{throw Error('AUTH_DATABASE_PRIVILEGES_INVALID');};
 const identity=await query(`SELECT current_user AS name,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolinherit,rolreplication,rolcanlogin,
  EXISTS(SELECT 1 FROM pg_auth_members WHERE member=pg_roles.oid OR roleid=pg_roles.oid) AS member_of_role,
  has_schema_privilege(current_user,'iway_private','CREATE') OR has_schema_privilege(current_user,'public','CREATE') AS can_create,
  has_schema_privilege('anon','iway_private','USAGE') OR has_schema_privilege('authenticated','iway_private','USAGE') AS client_schema
  FROM pg_roles WHERE rolname=current_user`);
 const role=identity.rows[0];
 if(role?.name!=='iway_auth_runtime'||role.rolsuper||role.rolbypassrls||role.rolcreaterole||role.rolcreatedb||
  role.rolinherit||role.rolreplication||!role.rolcanlogin||role.member_of_role||role.can_create||role.client_schema)fail();
 const relations=await query(`SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,
  pg_get_userbyid(c.relowner)=current_user AS owns,
  has_table_privilege(current_user,c.oid,'DELETE,TRUNCATE,TRIGGER,REFERENCES') OR
   (c.relname IN ('auth_tenant_roles','auth_tenants','auth_resources') AND
    (has_table_privilege(current_user,c.oid,'INSERT,UPDATE') OR has_any_column_privilege(current_user,c.oid,'INSERT,UPDATE'))) AS excessive,
  has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
  has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
  has_any_column_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,REFERENCES') OR
  has_any_column_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,REFERENCES') AS client_access,
  has_table_privilege(current_user,c.oid,'SELECT') AS can_read,
  (has_table_privilege(current_user,c.oid,'INSERT') AND has_table_privilege(current_user,c.oid,'UPDATE')) AS can_persist
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='iway_private' AND c.relname=ANY($1::text[]) AND c.relkind='r' AND NOT c.relispartition`,[tables]);
 if(relations.rowCount!==5||relations.rows.some(r=>!r.relrowsecurity||!r.relforcerowsecurity||r.owns||r.excessive||r.client_access||
  !r.can_read||(['auth_pkce_transactions','auth_server_sessions'].includes(r.relname)&&!r.can_persist)))fail();
 const columns=await query(`SELECT c.relname,a.attname,format_type(a.atttypid,a.atttypmod) AS type
  FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='iway_private' AND c.relname=ANY($1::text[]) AND a.attnum>0 AND NOT a.attisdropped`,[tables]);
 for(const [table,fields] of Object.entries(authColumns))for(const [column,type] of Object.entries(fields)){
  if(!columns.rows.some(r=>r.relname===table&&r.attname===column&&r.type===type))fail();
 }
 const result=await query(`SELECT c.relname,p.polname,p.polcmd,p.polpermissive,
  p.polroles=ARRAY[(SELECT oid FROM pg_roles WHERE rolname=current_user)] AS runtime_only,
  pg_get_expr(p.polqual,p.polrelid) AS using_expression,pg_get_expr(p.polwithcheck,p.polrelid) AS check_expression
  FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='iway_private' AND c.relname=ANY($1::text[])`,[tables]);
 if(result.rowCount!==5)fail();
 for(const row of result.rows){
  const expected=policies[row.polname];
  if(!expected||row.relname!==expected.table||row.polcmd!==expected.command||!row.polpermissive||!row.runtime_only||
   normalize(row.using_expression)!==normalize(expected.using)||normalize(row.check_expression)!==normalize(expected.check))fail();
 }
 const constraints=await query(`SELECT c.relname,k.contype,k.confdeltype,k.confupdtype,k.confmatchtype,k.condeferrable,k.convalidated,
  refn.nspname AS reference_schema,ref.relname AS reference_table,
  ARRAY(SELECT a.attname::text FROM unnest(k.conkey) WITH ORDINALITY cols(num,position)
    JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=cols.num ORDER BY cols.position) AS columns,
  ARRAY(SELECT a.attname::text FROM unnest(k.confkey) WITH ORDINALITY cols(num,position)
    JOIN pg_attribute a ON a.attrelid=k.confrelid AND a.attnum=cols.num ORDER BY cols.position) AS reference_columns
  FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  LEFT JOIN pg_class ref ON ref.oid=k.confrelid LEFT JOIN pg_namespace refn ON refn.oid=ref.relnamespace
  WHERE n.nspname='iway_private' AND c.relname=ANY($1::text[]) AND k.contype IN ('p','f')`,[tables]);
 const keys={auth_pkce_transactions:['state_hash'],auth_server_sessions:['session_hash'],auth_tenant_roles:['user_id','tenant_id','role'],auth_tenants:['tenant_id'],auth_resources:['resource_id']};
 if(constraints.rowCount!==8)fail();
 for(const [table,columns] of Object.entries(keys))if(!constraints.rows.some(r=>r.relname===table&&r.contype==='p'&&r.convalidated&&JSON.stringify(r.columns)===JSON.stringify(columns)))fail();
 for(const row of constraints.rows.filter(r=>r.contype==='f')){
  const resource=row.relname==='auth_resources';
  if(!['auth_server_sessions','auth_tenant_roles','auth_resources'].includes(row.relname)||!row.convalidated||row.condeferrable||row.confupdtype!=='a'||row.confmatchtype!=='s'||!(row.confdeltype==='r'||row.relname==='auth_tenant_roles'&&row.confdeltype==='c')||
   row.reference_schema!==(resource?'iway_private':'auth')||row.reference_table!==(resource?'auth_tenants':'users')||
   JSON.stringify(row.columns)!==JSON.stringify([resource?'tenant_id':'user_id'])||JSON.stringify(row.reference_columns)!==JSON.stringify([resource?'tenant_id':'id']))fail();
 }
 const extra=await query(`SELECT EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='iway_private' AND c.relname=ANY($1::text[]) AND NOT t.tgisinternal) AS triggers,
  EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p','v','m')
    AND NOT(n.nspname='iway_private' AND c.relname=ANY($1::text[]))
    AND (has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
     has_any_column_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))) AS unrelated_access`,[tables]);
 if(extra.rows[0]?.triggers||extra.rows[0]?.unrelated_access)fail();
 return true;
}
