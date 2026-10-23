// Synthetic local identities only. None are approved real tester identifiers.
import {DatabaseSync} from 'node:sqlite';
import {randomBytes} from 'node:crypto';
import {createUatFixtureStore} from '../../server/operations-uat-fixture-store.mjs';
import {createUatWorkflow} from '../../server/operations-uat-workflow.mjs';
import {createServerTokenCipher} from '../../server/operations-supabase-token-cipher.experimental.mjs';
const id=n=>'90000000-0000-4000-8000-'+String(n).padStart(12,'0');
export const syntheticRoster=['platform','carrier','fleet','driver'].map((role,i)=>({email:role+'@illustrative.invalid',userId:id(i+1),principalId:id(i+1),googleSubject:'synthetic-google-'+(i+1),role,tenantId:role==='platform'?null:id(10),fleetId:['fleet','driver'].includes(role)?id(20):null,permissions:role==='platform'?['platform:audit']:['load:view']}));
export const syntheticPassword='Illustrative-only-new-password';
export function uatFixture({path=':memory:',now=Date.now(),roster=syntheticRoster,signAccessToken}={}){
 const clock=()=>now,db=new DatabaseSync(path),cipher=createServerTokenCipher({key:randomBytes(32)});
 const store=createUatFixtureStore({db,cipher,fixtureOnly:true,clock});
 for(const entry of roster)store.seed(entry.userId);
 const memberships=new Map(roster.map(e=>[e.userId,{...e,active:true,revoked:false,tenantActive:true}]));
 const identities=new Map(),passwords=new Map(),rows=new Map(),mail=[];let providerCalls=0;
 function tokens(userId,assurance='aal1',googleSubject){
  const entry=roster.find(e=>e.userId===userId),accessToken=signAccessToken?.({userId,assurance,now:clock()})??randomBytes(32).toString('base64url'),refreshToken=randomBytes(32).toString('base64url');
  identities.set(accessToken,{id:userId,email:entry?.email??'fifth@illustrative.invalid',emailConfirmed:true,anonymous:false,assurance,googleSubjects:[googleSubject??entry?.googleSubject]});
  return {user:{id:userId},accessToken,refreshToken,accessExpiresAt:new Date(clock()+3600000)};
 }
 const provider={
  inspect:async token=>{const identity=identities.get(token);if(!identity)throw Error('synthetic denied');return identity;},
  passwordLogin:async({email,password})=>{providerCalls++;const entry=roster.find(e=>e.email===email);if(!entry||passwords.get(entry.userId)!==password)throw Error('synthetic invalid password');return tokens(entry.userId);},
  verifySetup:async proof=>{const userId=proof.replace('synthetic-recovery-','');return tokens(userId);},
  setPassword:async(token,password)=>{passwords.set(identities.get(token).id,password);},
  logout:async()=>{},
  refresh:async refreshToken=>{for(const row of rows.values())if(row.refresh_token===refreshToken)return tokens(row.user_id,identities.get(row.access_token)?.assurance);throw Error('synthetic denied');},
  challengeMfa:async()=>({factorId:id(80),challengeId:id(81)}),
  verifyMfa:async(current,code)=>{if(code!=='123456')throw Error('synthetic denied');return tokens(identities.get(current.accessToken).id,'aal2');}
 };
 const sessions={
  create:async data=>{const token=randomBytes(32).toString('base64url');rows.set(token,{user_id:data.userId,access_token:data.accessToken,refresh_token:data.refreshToken,expires:clock()+3600000});return {id:token};},
  get:async token=>{const row=rows.get(token);return row&&row.expires>clock()?row:null;},
  revoke:async token=>rows.delete(token),
  refresh:async(token,fn)=>{const row=rows.get(token);if(!row)throw Error('synthetic denied');const next=await fn(row.refresh_token);if(next.user.id!==row.user_id)throw Error('synthetic denied');row.access_token=next.accessToken;row.refresh_token=next.refreshToken;return {id:token};}
 };
 const dependencies={roster,store,provider,sessions,clock,
  lookupMembership:async userId=>memberships.get(userId),
  authenticateAdministrator:async token=>token==='synthetic-approved-admin'?{id:id(90),active:true,assurance:'aal2',permissions:['platform:invite']}:null,
  authorizeIssuance:async()=>true,
  issuer:{generateRecovery:async({userId})=>({userId,tokenHash:'synthetic-recovery-'+userId})},
  deliver:async message=>mail.push(message)};
 const workflow=createUatWorkflow(dependencies);
 async function activate(index=3){const entry=roster[index];await workflow.issue({adminSession:'synthetic-approved-admin',userId:entry.userId});await workflow.setup({token:mail.at(-1).token,password:syntheticPassword,network:'synthetic-network'});return entry;}
 return {db,store,workflow,provider,sessions,memberships,identities,passwords,rows,mail,tokens,dependencies,activate,advance:ms=>{now+=ms;},get providerCalls(){return providerCalls;}};
}
