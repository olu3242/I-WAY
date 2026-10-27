import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
const dir=process.argv[2]??'supabase/migrations';
const files=readdirSync(dir).filter(x=>/^\d{14}_.+\.sql$/.test(x)).sort();
function load(suffix){const matches=files.filter(x=>x.endsWith(suffix));if(matches.length!==1)throw Error('Expected exactly one '+suffix);return {name:matches[0],sql:readFileSync(join(dir,matches[0]),'utf8')};}
const early=load('_iway_early_access.sql'),prereq=load('_registration_role_prerequisites.sql'),login=load('_registration_login.sql'),ops=load('_operations_persistence_readiness.sql'),directory=load('_operations_dispatcher_directory.sql'),runtime=load('_operations_runtime_read_role.sql');
const checks=[
['registration dependency order',early.name<prereq.name&&prereq.name<login.name],
['registration role non-login',/CREATE ROLE iway_registration\s+NOLOGIN/i.test(prereq.sql)],
['registration role no RLS bypass',/CREATE ROLE iway_registration[^;]*NOBYPASSRLS/i.test(prereq.sql)],
['registration INSERT policy',/CREATE POLICY early_access_registration_insert[\s\S]*?FOR INSERT/i.test(prereq.sql)],
['operations users FORCE RLS',/ALTER TABLE operations_private\.users FORCE ROW LEVEL SECURITY/i.test(ops.sql)],
['runtime role non-login',/CREATE ROLE iway_operations_runtime\s+NOLOGIN/i.test(runtime.sql)],
['runtime grants read-only',!/GRANT\s+(INSERT|UPDATE|DELETE|TRUNCATE)/i.test(runtime.sql)],
['dispatcher FORCE RLS',/ALTER TABLE operations_private\.dispatcher_directory FORCE ROW LEVEL SECURITY/i.test(directory.sql)],
['dispatcher scoped INSERT policy',/CREATE POLICY\s+\w+\s+ON\s+operations_private\.dispatcher_directory[\s\S]*?FOR INSERT/i.test(directory.sql)]
];
for(const [name,pass] of checks)console.log((pass?'PASS':'BLOCKED')+': '+name);
const blocked=checks.filter(([,pass])=>!pass).length;
console.log(JSON.stringify({gate:'source-only',passed:checks.length-blocked,blocked,decision:blocked?'NO-GO':'SOURCE-ONLY-PASS'}));
process.exitCode=blocked?1:0;
