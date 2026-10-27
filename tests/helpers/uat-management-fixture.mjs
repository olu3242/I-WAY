// Test-only approvals and transport. No real addresses, credentials or provider calls.
import {randomUUID} from 'node:crypto';
import {createUatManagementPlane,uatRosterDigest} from '../../server/operations-uat-management.mjs';
export function managementMemoryStore(){
 const rows=new Map();return {rows,
  async claim(input){const row=rows.get(input.key);if(row)return {status:row.fingerprint!==input.fingerprint?'conflict':row.status==='completed'?'completed':'fenced'};
   if([...rows.values()].some(r=>r.userId===input.userId&&r.status!=='completed'))return {status:'fenced'};
   rows.set(input.key,{...input,status:'claimed'});return {status:'claimed',nonce:input.nonce,expires:input.expires};},
  async complete({key,nonce}){const row=rows.get(key);if(!row||row.nonce!==nonce||row.status!=='claimed')return false;row.status='completed';return true;},
  async uncertain({key,nonce}){const row=rows.get(key);if(row?.nonce===nonce&&row.status==='claimed')row.status='uncertain';}
 };
}
export function managementFixture(f,{commandStore=managementMemoryStore(),dependencies=f.dependencies}={}){
 const clock=dependencies.clock,now=clock(),messages=[];let generated=0,lookups=0;
 const actorId='90000000-0000-4000-8000-000000000090';
 const approval={id:randomUUID(),status:'approved',projectId:'prj_7uof3CdmN1QvzKxETkXvHjlrLjVm',rosterDigest:uatRosterDigest(dependencies.roster),origin:'https://uat.illustrative.invalid',actorIds:[actorId],operations:['setup','recovery','revoke'],notBefore:now,expiresAt:now+3600000};
 const users=new Map(dependencies.roster.map(e=>[e.userId,{id:e.userId,email:e.email,email_confirmed_at:new Date(now).toISOString(),identities:[{provider:'google',user_id:e.userId,id:e.googleSubject,identity_id:randomUUID(),identity_data:{sub:e.googleSubject}}]}]));
 const adminClient={supabaseUrl:'https://vnoxdinldneeczxibicp.supabase.co',auth:{admin:{
  getUserById:async id=>{lookups++;return {data:{user:users.get(id)}};},
  generateLink:async({type,email})=>{generated++;if(type!=='recovery')throw Error('SYNTHETIC_WRONG_PURPOSE');const entry=dependencies.roster.find(e=>e.email===email);return {data:{user:{id:entry.userId},properties:{hashed_token:'synthetic-recovery-'+entry.userId}}};}
 }}};
 const send=async message=>{messages.push(message);const token=new URL(message.text.split(' ').at(-1)).hash.slice(1);f.mail.push({email:message.to,token});return {accepted:true};};
 const config={workflowDependencies:dependencies,commandStore,getApproval:async()=>approval,adminClient,send,clock};
 return {plane:createUatManagementPlane(config),config,approval,messages,users,commandStore,get generated(){return generated;},get lookups(){return lookups;}};
}
