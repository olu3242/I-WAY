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
