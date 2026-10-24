// Synthetic local accounts only; no provider calls, actual users or live invitations.
import test from 'node:test';
import assert from 'node:assert/strict';
import {uatFixture,syntheticPassword} from './helpers/uat-fixture.mjs';

for(const index of [0,1,2,3])test(`B691 synthetic ${['platform','carrier','fleet','driver'][index]} setup, both providers, recovery and revocation`,async t=>{
 const f=uatFixture();t.after(()=>f.db.close());const entry=f.dependencies.roster[index];
 await assert.rejects(f.workflow.issue({adminSession:'unapproved-synthetic-admin',userId:entry.userId}));assert.equal(f.mail.length,0);
 await f.workflow.issue({adminSession:'synthetic-approved-admin',userId:entry.userId});
 const setup=f.mail.at(-1).token;
 await f.workflow.setup({token:setup,password:syntheticPassword,network:'synthetic-activation'});
 await assert.rejects(f.workflow.setup({token:setup,password:syntheticPassword,network:'synthetic-activation'}));
 const login=await f.workflow.passwordLogin({email:entry.email,password:syntheticPassword,network:'synthetic-login'});
 const password=login.mfaRequired?await f.workflow.completeMfa({pending:login.pending,code:'123456',network:'synthetic-login'}):login;
 if(login.mfaRequired){assert.equal(login.id,undefined);await assert.rejects(f.workflow.completeMfa({pending:login.pending,code:'123456',network:'synthetic-login'}));}
 assert.equal((await f.workflow.session(password.id)).principalId,entry.principalId);
 const google=await f.workflow.googleSession(f.tokens(entry.userId,['platform','carrier'].includes(entry.role)?'aal2':'aal1'),{network:'synthetic-google'});
 assert.equal((await f.workflow.session(google.id)).principalId,entry.principalId);
 await f.workflow.issue({adminSession:'synthetic-approved-admin',userId:entry.userId,purpose:'recovery'});
 await f.workflow.setup({token:f.mail.at(-1).token,password:syntheticPassword,network:'synthetic-recovery'});
 assert.equal(await f.workflow.session(password.id),null);assert.equal(await f.workflow.session(google.id),null);
 const current=await f.workflow.googleSession(f.tokens(entry.userId,['platform','carrier'].includes(entry.role)?'aal2':'aal1'),{network:'synthetic-google-after-recovery'});
 f.memberships.set(entry.userId,{...f.memberships.get(entry.userId),...(entry.role==='platform'?{active:false}:{tenantActive:false})});
 assert.equal(await f.workflow.session(current.id),null);
 f.memberships.set(entry.userId,{...f.memberships.get(entry.userId),active:true,tenantActive:true});
 await f.workflow.revoke({adminSession:'synthetic-approved-admin',userId:entry.userId});
 await assert.rejects(f.workflow.googleSession(f.tokens(entry.userId,'aal2'),{network:'synthetic-revoked'}));
});
