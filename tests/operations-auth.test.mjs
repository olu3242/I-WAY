import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,password} from './helpers/operations-fixture.mjs';
import {authenticate,session} from '../server/operations-auth.mjs';
test('local sessions expire, passwords are hashed, and audit never contains authentication material',async t=>{
 const f=await fixture(t),now=Date.now(),login=authenticate(f.store,f.manager.username,password,now);
 assert.ok(session(f.store,login.token,now));assert.equal(session(f.store,login.token,now+8*3600000),null);
 const row=f.store.db.prepare('SELECT password FROM users WHERE id=?').get(f.manager.id);
 assert.notEqual(row.password,password);assert.match(row.password,/^[a-f0-9]{32}:[a-f0-9]{128}$/);
 const audit=JSON.stringify(f.ops.state(f.manager.id).audit);
 for(const sensitive of [password,login.token,login.csrf,row.password])assert.equal(audit.includes(sensitive),false);
 assert.throws(()=>authenticate(f.store,f.manager.username,'wrong'),e=>e.code==='LOGIN');
});
