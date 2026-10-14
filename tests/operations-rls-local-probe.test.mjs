import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const script=new URL('../scripts/operations-rls-local-probe.mjs',import.meta.url);
test('B61 local RLS probe is opt-in and fails closed without local fixture configuration',()=>{
 const env={...process.env};
 for(const key of Object.keys(env))if(key.startsWith('IWAY_B61_'))delete env[key];
 const run=spawnSync(process.execPath,[fileURLToPath(script)],{env,encoding:'utf8',timeout:10000});
 assert.equal(run.status,1);
 const result=JSON.parse(run.stderr.trim());
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.gate,'B61_POSTGRES_RLS');
 assert.doesNotMatch(run.stdout+run.stderr,/postgresql:\/\/|password=/i);
});
test('B61 RLS probe requires forced policies and checks unfiltered tenant visibility',()=>{
 const source=readFileSync(script,'utf8');
 assert.match(source,/relforcerowsecurity/);
 assert.match(source,/SELECT DISTINCT tenant_id FROM operations_private\.users/);
 assert.match(source,/SELECT DISTINCT tenant_id FROM operations_private\.resources/);
 assert.doesNotMatch(source,/SELECT id FROM operations_private\.users WHERE tenant_id=\$1 LIMIT 1/);
});
