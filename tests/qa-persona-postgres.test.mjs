import test from 'node:test';
import assert from 'node:assert/strict';
import {createQaPersonaPostgres} from '../domain/qa-persona-postgres.mjs';
function fakePool({failAudit=false,updateCount=1}={}){
 const calls=[];
 const client={query:async(sql,args)=>{calls.push({sql,args});if(failAudit&&sql.includes('qa_persona_audit'))throw Error('AUDIT_FAILED');return {rowCount:updateCount,rows:[]}},release(){}};
 return {calls,connect:async()=>client,query:client.query};
}
const session={id:'00000000-0000-4000-8000-000000000001',actorId:'a',targetId:'t',tenantId:'x',role:'driver',reason:'QA testing',issuedAt:1000,expiresAt:901000};
const audit={actorId:'a',effectiveActorId:'t',tenantId:'x'};
test('session issuance and audit share a transaction',async()=>{
 const pool=fakePool();await createQaPersonaPostgres({pool}).issue(session,audit);
 assert.equal(pool.calls[0].sql,'BEGIN');assert.equal(pool.calls.at(-1).sql,'COMMIT');
 assert.equal(pool.calls.filter(c=>c.sql.includes('INSERT')).length,2);
});
test('audit failure rolls back issuance',async()=>{
 const pool=fakePool({failAudit:true});
 await assert.rejects(createQaPersonaPostgres({pool}).issue(session,audit),/AUDIT_FAILED/);
 assert.equal(pool.calls.at(-1).sql,'ROLLBACK');
});
test('revocation and stop audit share transaction',async()=>{
 const pool=fakePool();await createQaPersonaPostgres({pool}).stop({sessionId:session.id,actorId:'a',effectiveActorId:'t',tenantId:'x'});
 assert.equal(pool.calls.at(-1).sql,'COMMIT');
});
test('failed revocation cannot append stop audit',async()=>{
 const pool=fakePool({updateCount:0});
 await assert.rejects(createQaPersonaPostgres({pool}).stop({sessionId:session.id,actorId:'a',effectiveActorId:'t',tenantId:'x'}),/QA_PERSONA_DENIED/);
 assert.equal(pool.calls.at(-1).sql,'ROLLBACK');
});
