import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../sql/sop-local-rls.sql',import.meta.url),'utf8');
test('SOP B4: dedicated role is non-login and non-bypass',()=>{
 assert.match(sql,/CREATE ROLE iway_sop_runtime NOLOGIN NOBYPASSRLS/);
 const statements=sql.replace(/^\s*--.*$/gm,'').split(';').map(x=>x.trim()).filter(Boolean);
 const roleStatement=statements.find(x=>/CREATE ROLE\s+iway_sop_runtime\b/i.test(x));
 assert.ok(roleStatement,'runtime role must be created');
 assert.match(roleStatement,/\bNOLOGIN\s+NOBYPASSRLS\b/i);
 assert.doesNotMatch(roleStatement,/(?<!NO)\bBYPASSRLS\b/i);
 assert.doesNotMatch(roleStatement,/(?<!NO)\bLOGIN\b/i);
});
test('SOP B4: policies cover tenant reads and writes',()=>{
 for(const policy of ['sop_articles_tenant_select','sop_tickets_tenant_select','sop_tickets_tenant_insert','sop_tickets_tenant_update','sop_events_tenant_insert'])assert.match(sql,new RegExp('CREATE POLICY '+policy+'\\b'));
 assert.match(sql,/current_setting\('iway.verified_tenant',true\)/);
 assert.match(sql,/current_setting\('iway.verified_actor',true\)/);
});
test('SOP B4: no public grants and no security definer',()=>{
 assert.doesNotMatch(sql,/GRANT\s+\w+\s+ON\s+.+\s+TO\s+(PUBLIC|anon|authenticated)\b/i);
 assert.doesNotMatch(sql,/SECURITY DEFINER/i);
});
