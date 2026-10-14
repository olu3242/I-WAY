import test from 'node:test';
import assert from 'node:assert/strict';
import {createSopPostgresRepository} from '../postgres-repository.mjs';
const session={verified:true,tenantMembershipVerified:true,subjectId:'d1',tenantId:'t1',role:'driver'};
function fakePool(handler){
 const calls=[];let released=0;
 return {calls,get released(){return released},async connect(){return {async query(sql,args){calls.push({sql,args});return handler(sql,args)},release(){released++}}}};
}
test('SOP PG: scoped knowledge lookup parameterizes tenant and role',async()=>{
 const p=fakePool(()=>({rows:[]}));
 await createSopPostgresRepository(p).listApprovedArticles({tenantId:'t1',role:'driver'});
 assert.match(p.calls[0].sql,/tenant_id=\$1/);
 assert.deepEqual(p.calls[0].args,['t1','approved','driver']);
 assert.equal(p.released,1);
});
test('SOP PG: cross-tenant knowledge rows fail closed',async()=>{
 const p=fakePool(()=>({rows:[{tenantId:'t2'}]}));
 await assert.rejects(()=>createSopPostgresRepository(p).listApprovedArticles({tenantId:'t1',role:'driver'}),/SOP_SCOPE_VIOLATION/);
 assert.equal(p.released,1);
});
test('SOP PG: ticket insert commits only verified tenant receipt',async()=>{
 const p=fakePool(sql=>sql.startsWith('INSERT')?{rowCount:1,rows:[{id:'ticket-1',tenant_id:'t1'}]}:{});
 const r=await createSopPostgresRepository(p).createTicketTransaction({tenantId:'t1',actorId:'d1',ticket:{tenantId:'t1',requesterId:'d1',status:'open',subject:'Load issue',priority:'P3'}});
 assert.equal(r.persisted,true);
 assert.deepEqual(p.calls.map(x=>x.sql==='BEGIN'?'BEGIN':x.sql==='COMMIT'?'COMMIT':'INSERT'),['BEGIN','INSERT','COMMIT']);
});
test('SOP PG: forged insert receipt rolls back',async()=>{
 const p=fakePool(sql=>sql.startsWith('INSERT')?{rowCount:1,rows:[{id:'ticket-1',tenant_id:'t2'}]}:{});
 await assert.rejects(()=>createSopPostgresRepository(p).createTicketTransaction({tenantId:'t1',actorId:'d1',ticket:{tenantId:'t1',requesterId:'d1',status:'open',subject:'Load issue',priority:'P3'}}));
 assert.equal(p.calls.at(-1).sql,'ROLLBACK');
});
test('SOP PG: invalid transition rolls back without mutation',async()=>{
 const p=fakePool(sql=>sql.startsWith('SELECT')?{rowCount:1,rows:[{status:'open'}]}:{});
 await assert.rejects(()=>createSopPostgresRepository(p).transitionTicketTransaction({tenantId:'t1',actorId:'s1',ticketId:'ticket-1',next:'closed'}),/SOP_TRANSITION_DENIED/);
 assert.equal(p.calls.at(-1).sql,'ROLLBACK');
 assert.equal(p.calls.some(x=>x.sql.startsWith('UPDATE')),false);
});
test('SOP PG: valid transition writes event in same transaction',async()=>{
 const p=fakePool(sql=>sql.startsWith('SELECT')?{rowCount:1,rows:[{status:'open'}]}:sql.startsWith('UPDATE')?{rowCount:1,rows:[{tenant_id:'t1'}]}:{rowCount:1});
 const r=await createSopPostgresRepository(p).transitionTicketTransaction({tenantId:'t1',actorId:'s1',ticketId:'ticket-1',next:'triaged'});
 assert.equal(r.persisted,true);
 assert.equal(p.calls.some(x=>x.sql.includes('sop_ticket_events')),true);
 assert.equal(p.calls.at(-1).sql,'COMMIT');
});
