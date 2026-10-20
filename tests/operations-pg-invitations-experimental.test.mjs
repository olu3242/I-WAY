import test from 'node:test';
import assert from 'node:assert/strict';
import {createPgInvitationRepository} from '../server/operations-pg-invitations.experimental.mjs';
const hex='a'.repeat(64);
const id='11111111-1111-4111-8111-111111111111';
const input={tenantId:id,creatorId:id,recipient:'synthetic@illustrative.invalid',assignment:{role:'driver'},issuer:'test-issuer',subjectHash:hex,tokenHash:'b'.repeat(64),expiresAt:new Date(Date.now()+60000)};
test('rejects missing restricted transaction boundary',()=>assert.throws(()=>createPgInvitationRepository(),/RESTRICTED_TRANSACTION_REQUIRED/));
test('rejects invalid invitation before persistence',async()=>{
 const repo=createPgInvitationRepository(async()=>{throw Error('SHOULD_NOT_RUN')});
 await assert.rejects(repo.create({...input,subjectHash:'invalid'}),/INVALID_INVITATION/);
});
test('creation and audit share transaction callback',async()=>{
 const calls=[];
 const repo=createPgInvitationRepository(async fn=>fn({query:async(sql,args)=>{calls.push({sql,args});return {rows:[{id,state:'CREATED'}],rowCount:1}}}));
 const result=await repo.create(input);
 assert.equal(result.state,'CREATED');
 assert.equal(calls.length,2);
 assert.match(calls[0].sql,/INSERT INTO operations_onboarding.invitations/);
 assert.match(calls[1].sql,/INSERT INTO operations_onboarding.invitation_events/);
});
test('failed conditional transition never records audit',async()=>{
 const calls=[];
 const repo=createPgInvitationRepository(async fn=>fn({query:async(sql)=>{calls.push(sql);return {rows:[],rowCount:0}}}));
 await assert.rejects(repo.recordTransition({id,tenantId:id,actorId:id,from:'SENT',to:'OPENED'}),/TRANSITION_REJECTED/);
 assert.equal(calls.length,1);
});
test('transition and audit use one transaction callback',async()=>{
 const calls=[];
 const repo=createPgInvitationRepository(async fn=>fn({query:async(sql)=>{calls.push(sql);return {rows:[{id,state:'OPENED'}],rowCount:1}}}));
 await repo.recordTransition({id,tenantId:id,actorId:id,from:'SENT',to:'OPENED'});
 assert.equal(calls.length,2);
});

test('terminal invitation state cannot be replayed',async()=>{
 let invoked=false;
 const repo=createPgInvitationRepository(async()=>{invoked=true});
 await assert.rejects(repo.recordTransition({id,tenantId:id,actorId:id,from:'ACTIVE',to:'OPENED'}),/INVALID_TRANSITION/);
 assert.equal(invoked,false);
});
test('illegal state jumps fail before SQL execution',async()=>{
 let invoked=false;
 const repo=createPgInvitationRepository(async()=>{invoked=true});
 await assert.rejects(repo.recordTransition({id,tenantId:id,actorId:id,from:'CREATED',to:'ACTIVE'}),/INVALID_TRANSITION/);
 assert.equal(invoked,false);
});
test('simulated concurrent conditional transition permits only one winner',async()=>{
 let current='SENT',audits=0;
 const transaction=async fn=>fn({query:async sql=>{
  if(sql.includes('UPDATE operations_onboarding.invitations')){
   if(current!=='SENT')return {rowCount:0,rows:[]};
   current='OPENED';return {rowCount:1,rows:[{id,state:current}]};
  }
  audits++;return {rowCount:1,rows:[]};
 }});
 const repo=createPgInvitationRepository(transaction);
 const attempts=await Promise.allSettled(Array.from({length:8},()=>repo.recordTransition({id,tenantId:id,actorId:id,from:'SENT',to:'OPENED'})));
 assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(attempts.filter(x=>x.status==='rejected').length,7);
 assert.equal(audits,1);
});

test('verified acceptance binds issuer and subject and appends audit atomically',async()=>{
 const queries=[];
 const repo=createPgInvitationRepository(async fn=>fn({query:async(sql,args)=>{
  queries.push({sql,args});
  if(sql.includes('UPDATE operations_onboarding.invitations'))return {rowCount:1,rows:[{id,state:'ACCEPTED'}]};
  return {rowCount:1,rows:[]};
 }}));
 const result=await repo.acceptVerified({id,tenantId:id,actorId:id,verifiedSubjectHash:hex,verifiedIssuer:'test-issuer'});
 assert.equal(result.state,'ACCEPTED');
 assert.match(queries[0].sql,/state='VERIFIED'/);
 assert.match(queries[0].sql,/subject_hash=\$3 AND issuer=\$4/);
 assert.equal(queries[1].args[2],'ACCEPTED');
});
test('acceptance rejects mismatched identity or replay without audit',async()=>{
 let audits=0;
 const repo=createPgInvitationRepository(async fn=>fn({query:async sql=>{
  if(sql.includes('UPDATE operations_onboarding.invitations'))return {rowCount:0,rows:[]};
  audits++;return {rowCount:1,rows:[]};
 }}));
 await assert.rejects(repo.acceptVerified({id,tenantId:id,actorId:id,verifiedSubjectHash:hex,verifiedIssuer:'wrong-issuer'}),/ACCEPTANCE_REJECTED/);
 assert.equal(audits,0);
});
test('acceptance rejects absent trusted identity proof before transaction',async()=>{
 let invoked=false;
 const repo=createPgInvitationRepository(async()=>{invoked=true});
 await assert.rejects(repo.acceptVerified({id,tenantId:id,actorId:id,verifiedSubjectHash:'bad',verifiedIssuer:'test-issuer'}),/VERIFIED_IDENTITY_REQUIRED/);
 assert.equal(invoked,false);
});
