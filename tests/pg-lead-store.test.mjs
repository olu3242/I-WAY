import test from 'node:test';import assert from 'node:assert/strict';import {registerPgLead} from '../server/pg-lead-store.mjs';
const lead={name:'A Person',email:'person@example.com',role:'driver',consent:true};
test('parameterized insert and durable-store response',async()=>{let sql,params;const pool={query:async(s,p)=>{sql=s;params=p;return {rowCount:1}}};assert.deepEqual(await registerPgLead(pool,lead),{created:true});assert.match(sql,/ON CONFLICT \(email_hash\) DO NOTHING/);assert.equal(params[2],'person@example.com');assert.equal(params.length,7)});
test('duplicate email is idempotent',async()=>{const pool={query:async()=>({rowCount:0})};assert.deepEqual(await registerPgLead(pool,lead),{created:false})});
test('rejects missing consent before database call',async()=>{let called=false;const pool={query:async()=>{called=true}};await assert.rejects(registerPgLead(pool,{...lead,consent:false}),/Invalid/);assert.equal(called,false)});
