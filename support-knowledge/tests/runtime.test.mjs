import test from 'node:test';
import assert from 'node:assert/strict';
import {handleSopRequest,submitSopTicket,advanceSopTicket} from '../runtime.mjs';
const session={verified:true,tenantMembershipVerified:true,subjectId:'d1',tenantId:'t1',role:'driver'};
const resource={tenantId:'t1',ownerId:'d1'};
const article={id:'a1',title:'Load assignment',body:'Open your assigned load.',tenantId:'t1',status:'approved',approvedBy:'reviewer',authoredBy:'author',version:'1',source:'SOP-007'};
test('SOP runtime denies unverified sessions and cross tenant resources',async()=>{
 assert.equal((await handleSopRequest({session:{...session,verified:false},message:'load',resource,repository:{}})).status,'denied');
 assert.equal((await handleSopRequest({session,message:'load',resource:{tenantId:'t2'},repository:{}})).status,'denied');
});
test('SOP runtime returns cited approved source only from tenant scoped repository',async()=>{
 const r=await handleSopRequest({session,message:'load',resource,repository:{listApprovedArticles:async()=>[article]}});
 assert.equal(r.status,'answered');assert.equal(r.citations[0].source,'SOP-007');
});
test('SOP runtime rejects repository cross tenant leaks and failures',async()=>{
 assert.equal((await handleSopRequest({session,message:'load',resource,repository:{listApprovedArticles:async()=>[{...article,tenantId:'t2'}]}})).status,'unavailable');
 assert.equal((await handleSopRequest({session,message:'load',resource,repository:{listApprovedArticles:async()=>{throw Error('db')}}})).status,'unavailable');
});
test('SOP ticket creation requires transactional persisted receipt',async()=>{
 assert.equal((await submitSopTicket({session,resource,subject:'Load missing'})).status,'unavailable');
 assert.equal((await submitSopTicket({session,resource,subject:'Load missing',repository:{createTicketTransaction:async()=>({persisted:true,tenantId:'t2',ticketId:'x1'})}})).status,'unavailable');
 assert.equal((await submitSopTicket({session,resource,subject:'Load missing',repository:{createTicketTransaction:async()=>({persisted:true,tenantId:'t1',ticketId:'x1'})}})).status,'created');
});
test('SOP transitions deny driver and reject unverified persistence',async()=>{
 assert.equal((await advanceSopTicket({session,ticketId:'x1',next:'triaged',repository:{transitionTicketTransaction:async()=>({persisted:true,tenantId:'t1',ticketId:'x1'})}})).status,'denied');
 const support={...session,role:'support',subjectId:'s1'};
 assert.equal((await advanceSopTicket({session:support,ticketId:'x1',next:'triaged',repository:{transitionTicketTransaction:async()=>({persisted:false})}})).status,'unavailable');
});
