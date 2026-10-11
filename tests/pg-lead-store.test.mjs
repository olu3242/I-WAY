import test from 'node:test';import assert from 'node:assert/strict';import {registerPgLead} from '../server/pg-lead-store.mjs';
const lead={name:'A Person',email:'person@example.com',role:'driver',consent:true};
const config={consentVersion:'2026-10-reviewed'};
test('private schema, insert-only SQL, parameterization and consent version',async()=>{let sql,params;const pool={query:async(s,p)=>{sql=s;params=p;return {rowCount:1}}};assert.deepEqual(await registerPgLead(pool,lead,config),{created:true});assert.match(sql,/INSERT INTO iway_private\.early_access_leads/);assert.match(sql,/ON CONFLICT \(email_hash\) DO NOTHING/);assert.doesNotMatch(sql,/RETURNING|SELECT|UPDATE|DELETE FROM/i);assert.equal(params[2],'person@example.com');assert.equal(params[7],config.consentVersion);assert.equal(params.length,8)});
test('duplicate email is idempotent',async()=>{const pool={query:async()=>({rowCount:0})};assert.deepEqual(await registerPgLead(pool,lead,config),{created:false})});
test('rejects missing consent before database call',async()=>{let called=false;const pool={query:async()=>{called=true}};await assert.rejects(registerPgLead(pool,{...lead,consent:false},config),/Invalid/);assert.equal(called,false)});
test('rejects missing consent version',async()=>{await assert.rejects(registerPgLead({query:async()=>{throw Error('must not execute')}},lead),/consent version/)});
