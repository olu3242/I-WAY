import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseTestInvitationProvisioner} from '../server/operations-supabase-test-invitations.experimental.mjs';
const tenantId='11111111-1111-4111-8111-111111111111';
const redirectTo='https://staging.iway.example/auth/callback';
test('B446 requires explicit approval and an allowlisted redirect',async()=>{
 let sent=0;
 const provisioner=createSupabaseTestInvitationProvisioner({
  authAdmin:{inviteUserByEmail:async()=>{sent++;return {data:{user:{id:'u'}}};}},
  roleStore:{grant:async()=>{}},allowedRedirects:[redirectTo]});
 await assert.rejects(provisioner.invite({email:'test@example.com',tenantId,role:'driver',redirectTo}),/APPROVAL_REQUIRED/);
 await assert.rejects(provisioner.invite({email:'test@example.com',tenantId,role:'driver',redirectTo:'https://evil.example',approved:true}),/INVALID_TEST_INVITATION_SCOPE/);
 assert.equal(sent,0);
});
test('B446 binds role only after Supabase invitation succeeds',async()=>{
 const calls=[];
 const provisioner=createSupabaseTestInvitationProvisioner({
  authAdmin:{inviteUserByEmail:async(email)=>{calls.push('invite');return {data:{user:{id:'user-1'}}};}},
  roleStore:{grant:async()=>calls.push('grant')},allowedRedirects:[redirectTo]});
 const result=await provisioner.invite({email:'test@example.com',tenantId,role:'driver',redirectTo,approved:true});
 assert.deepEqual(calls,['invite','grant']);
 assert.equal(result.status,'INVITED');
});
test('B446 rejects failed invitations without role grants',async()=>{
 let granted=false;
 const provisioner=createSupabaseTestInvitationProvisioner({
  authAdmin:{inviteUserByEmail:async()=>({error:new Error('secret')})},
  roleStore:{grant:async()=>{granted=true;}},allowedRedirects:[redirectTo]});
 await assert.rejects(provisioner.invite({email:'test@example.com',tenantId,role:'driver',redirectTo,approved:true}),/SUPABASE_INVITATION_FAILED/);
 assert.equal(granted,false);
});
