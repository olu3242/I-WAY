import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {registerPgLead} from '../server/pg-lead-store.mjs';
const lead={name:'A Person',email:' Person@Example.COM ',role:'driver',consent:true};
const config={consentVersion:'2026-10-reviewed'};
test('parameterized insert-only SQL hashes normalized email and records consent',async()=>{
 let sql,params;
 const pool={query:async(s,p)=>{sql=s;params=p;return {rowCount:1,rows:[]}}};
 assert.deepEqual(await registerPgLead(pool,lead,config),{created:true});
 assert.match(sql,/INSERT INTO iway_private\.early_access_leads/);
 assert.match(sql,/VALUES \(\$1,\$2,\$3,\$4,\$5,\$6,\$7,\$8,NOW\(\)\)/);
 assert.match(sql,/ON CONFLICT DO NOTHING\s*$/);
 assert.doesNotMatch(sql,/RETURNING|SELECT|UPDATE|DELETE|person@example/i);
 assert.equal(params[2],'person@example.com');
 assert.equal(params[3],createHash('sha256').update('person@example.com').digest('hex'));
 assert.equal(params[6],true);assert.equal(params[7],config.consentVersion);assert.equal(params.length,8);
});
test('duplicate detection uses rowCount, never returned rows',async()=>{
 for(const [rowCount,created] of [[0,false],[1,true]]){
  assert.deepEqual(await registerPgLead({query:async()=>({rowCount,rows:[]})},lead,config),{created});
 }
});
test('invalid consent never reaches PostgreSQL',async()=>{
 for(const consent of [false,undefined,null,'true',1]){
  await assert.rejects(registerPgLead({query:async()=>assert.fail('must not execute')},{...lead,consent},config),/Invalid/);
 }
});
test('missing or invalid consent version never reaches PostgreSQL',async()=>{
 for(const consentVersion of [undefined,'','not approved','x'.repeat(31)]){
  await assert.rejects(registerPgLead({query:async()=>assert.fail('must not execute')},lead,{consentVersion}),/consent version/);
 }
});
test('database errors propagate instead of becoming duplicates',async()=>{
 const error=Object.assign(new Error('denied'),{code:'42501'});
 await assert.rejects(registerPgLead({query:async()=>{throw error}},lead,config),e=>e===error);
});
