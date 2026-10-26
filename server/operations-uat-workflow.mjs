// Staging candidate only: not imported by the deployed runtime or its packager.
// All provider calls require injected server-side adapters; no mail/admin secrets here.
import {randomBytes} from 'node:crypto';
import {rolePermissions} from '../domain/authorization.mjs';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const opaque=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v);
const denied=()=>{throw Error('UAT_ACCESS_DENIED');};
const email=v=>typeof v==='string'?v.trim().toLowerCase():'';
export function validateUatRoster(roster){
 if(!Array.isArray(roster)||roster.length!==4)throw Error('UAT_FOUR_APPROVED_BINDINGS_REQUIRED');
 for(const entry of roster){
  if(!uuid(entry.userId)||!uuid(entry.principalId)||!/^\S+@\S+\.\S+$/.test(entry.email)||entry.email!==email(entry.email)||
   !['platform','carrier','fleet','driver'].includes(entry.role)||(entry.googleSubject!==null&&(typeof entry.googleSubject!=='string'||!entry.googleSubject.trim()))||
   !Array.isArray(entry.permissions)||entry.permissions.some(p=>!rolePermissions[entry.role].includes(p))||new Set(entry.permissions).size!==entry.permissions.length||
   (entry.role==='platform'?(entry.tenantId!==null||entry.fleetId!==null):!uuid(entry.tenantId))||
   (['fleet','driver'].includes(entry.role)&&!uuid(entry.fleetId)))throw Error('UAT_ROSTER_BINDING_INCOMPLETE');
 }
 for(const key of ['userId','email','principalId','role'])if(new Set(roster.map(e=>e[key])).size!==4)throw Error('UAT_ROSTER_BINDING_NOT_UNIQUE');
 const googleSubjects=roster.map(e=>e.googleSubject).filter(v=>v!==null);
 if(new Set(googleSubjects).size!==googleSubjects.length)throw Error('UAT_ROSTER_BINDING_NOT_UNIQUE');
 return Object.freeze(roster.map(e=>Object.freeze({...e,permissions:Object.freeze([...e.permissions])})));
}
export function createUatWorkflow({roster,store,provider,sessions,lookupMembership,authenticateAdministrator,authorizeIssuance,issuer,deliver,clock=()=>Date.now()}={}){
 const entries=validateUatRoster(roster),byId=new Map(entries.map(e=>[e.userId,e])),byEmail=new Map(entries.map(e=>[e.email,e]));
 if(!store||![provider?.inspect,provider?.passwordLogin,provider?.verifySetup,provider?.setPassword,provider?.logout,provider?.refresh,provider?.challengeMfa,provider?.verifyMfa,sessions?.create,sessions?.get,sessions?.getForRefresh,sessions?.revoke,sessions?.refresh,lookupMembership,authenticateAdministrator,authorizeIssuance,issuer?.generateRecovery,deliver].every(fn=>typeof fn==='function'))throw Error('UAT_SECURE_DEPENDENCIES_REQUIRED');
 async function limit(network,entry){
  if(typeof network!=='string'||network.length>100||!await store.limit('global',60,60000)||!await store.limit('network:'+network,10,60000)||entry&&!await store.limit('account:'+entry.userId,5,900000))denied();
 }
 async function membership(entry){
  const row=await lookupMembership(entry.userId),state=await store.state(entry.userId);
  if(!state?.active||!row?.active||row.revoked||row.role!==entry.role||row.tenantId!==entry.tenantId||row.fleetId!==entry.fleetId||row.principalId!==entry.principalId||
   !Array.isArray(row.permissions)||JSON.stringify([...row.permissions].sort())!==JSON.stringify([...entry.permissions].sort())||
   entry.role!=='platform'&&row.tenantActive!==true)denied();
  return state;
 }
 async function admit(accessToken,method,expectedId){
  // inspect must verify JWT signature/issuer/audience/expiry AND fetch current provider user.
  const identity=await provider.inspect(accessToken),entry=byId.get(identity?.id);
  if(!entry||expectedId&&entry.userId!==expectedId||identity.emailConfirmed!==true||email(identity.email)!==entry.email||identity.anonymous||
    method==='google'&&(!entry.googleSubject||!identity.googleSubjects?.includes(entry.googleSubject)))denied();
  const state=await membership(entry);
  if(method==='password'&&!state.ready)denied();
  return {entry,state,identity};
 }
 async function createSession(tokens,method,expectedId){
  const admitted=await admit(tokens.accessToken,method,expectedId);
  if(['platform','carrier'].includes(admitted.entry.role)&&admitted.identity.assurance!=='aal2'){
   const challenge=await provider.challengeMfa(tokens.accessToken);
   const pending=randomBytes(32).toString('base64url');await store.saveMfa(pending,admitted.entry.userId,admitted.state.version,{...tokens,challenge,method});
   return {mfaRequired:true,pending};
  }
  const result=await sessions.create({userId:admitted.entry.userId,accessToken:tokens.accessToken,refreshToken:tokens.refreshToken,accessExpiresAt:tokens.accessExpiresAt});
  try{
   const current=await membership(admitted.entry);if(current.version!==admitted.state.version)denied();
   await store.bind(result.id,admitted.entry.userId,current.version,method);await store.audit('session.created',admitted.entry.userId);return {id:result.id};
  }catch{await sessions.revoke(result.id);denied();}
 }
 async function admin(session,userId){
  const actor=await authenticateAdministrator(session),entry=byId.get(userId);
  if(!entry||!uuid(actor?.id)||!actor.active||actor.assurance!=='aal2'||!actor.permissions?.includes('platform:invite')||!await authorizeIssuance({actor,entry}))denied();
  return {entry,actor};
 }
 return Object.freeze({
  maintain:()=>store.recoverExpired(),
  async issue({adminSession,userId,purpose='setup',ttlSeconds=3600}={}){
   const {entry,actor}=await admin(adminSession,userId);
   if(!['setup','recovery'].includes(purpose)||!Number.isInteger(ttlSeconds)||ttlSeconds<60||ttlSeconds>86400)denied();
   await limit('administrative-issuance',entry);await store.audit('invitation.requested',userId,actor.id);
   let token;
   try{
    // Separate approved control-plane issuer. Recovery never creates an Auth user.
    const generated=await issuer.generateRecovery({email:entry.email,userId});
    if(generated?.userId!==userId||typeof generated.tokenHash!=='string'||!generated.tokenHash)denied();
    token=randomBytes(32).toString('base64url');
    await store.saveInvite({token,userId,proof:generated.tokenHash,expires:clock()+ttlSeconds*1000,purpose,actorId:actor.id});
    await deliver({email:entry.email,token,purpose}); // Transport creates the fixed-origin fragment link; never log.
    return {ok:true};
   }catch{await store.revoke(userId);await store.audit('invitation.failed',userId,actor.id);throw Error('UAT_INVITATION_UNAVAILABLE');}
  },
  async setup({token,password,network}={}){
   await limit(network);if(!opaque(token)||typeof password!=='string'||password.length<15||password.length>128)denied();
   const invite=await store.consumeInvite(token);if(!invite)denied();
   let verified;
   try{
    const entry=byId.get(invite.user_id);if(!entry)denied();await membership(entry);
    verified=await provider.verifySetup(invite.proof);
    if((await admit(verified.accessToken,'setup',invite.user_id)).state.version!==invite.version)denied();
    await provider.setPassword(verified.accessToken,password);
    if(!await store.activate(invite.user_id,invite.version))denied();
    return {ok:true,signInRequired:true}; // Setup proof never creates an application session.
   }catch{await store.audit('password.setup.failed',invite.user_id);throw Error('UAT_SETUP_REJECTED');}
   finally{if(verified?.accessToken)await provider.logout(verified.accessToken).catch(()=>{});}
  },
  async passwordLogin({email:input,password,network}={}){
   const entry=byEmail.get(email(input));await limit(network,entry);
   if(!entry||typeof password!=='string'||password.length<1||password.length>128)denied();
   const initial=await membership(entry);if(!initial.ready)denied();
   let tokens;
   try{
    tokens=await provider.passwordLogin({email:entry.email,password});
    const admitted=await admit(tokens.accessToken,'password',entry.userId);
    if(initial.version!==admitted.state.version)denied();
    return await createSession(tokens,'password',entry.userId);
   }catch{if(tokens?.accessToken)await provider.logout(tokens.accessToken).catch(()=>{});throw Error('UAT_ACCESS_DENIED');}
  },
  async completeMfa({pending,code,network}={}){
   await limit(network);if(!opaque(pending)||typeof code!=='string'||!/^\d{6}$/.test(code))denied();
   const row=await store.consumeMfa(pending);if(!row)denied();
   let elevated,success=false;
   try{
    await admit(row.tokens.accessToken,row.tokens.method,row.user_id);
    elevated=await provider.verifyMfa(row.tokens,code);
    const entry=byId.get(row.user_id);if((await membership(entry)).version!==row.version)denied();
    if((await provider.inspect(elevated.accessToken)).assurance!=='aal2')denied();
    const result=await createSession(elevated,row.tokens.method,row.user_id);success=true;return result;
   }catch{if(elevated?.accessToken)await provider.logout(elevated.accessToken).catch(()=>{});throw Error('UAT_ACCESS_DENIED');}
   finally{if(!success)await provider.logout(row.tokens.accessToken).catch(()=>{});}
  },
  async beginGoogle({network}){await limit(network);},
  async cancelMfa(pending){
   if(!opaque(pending))return {ok:true};
   const row=await store.consumeMfa(pending);
   if(row){await provider.logout(row.tokens.accessToken).catch(()=>{});await store.audit('mfa.cancelled',row.user_id);}
   return {ok:true};
  },
  async googleSession(tokens,{network}={}){try{if(network)await limit(network);return await createSession(tokens,'google');}catch{if(tokens?.accessToken)await provider.logout(tokens.accessToken).catch(()=>{});denied();}},
  async session(id){
   if(!opaque(id))return null;
   try{
    const binding=await store.binding(id);if(!binding)denied();
    const current=await sessions.get(id);
    // An expired access token or an in-flight refresh grants no request access.
    // Keep the absolute-lifetime row available for its atomic refresh claim.
    if(!current)return null;
    if(binding.user_id!==current.user_id)denied();
    const {entry,state,identity}=await admit(current.access_token,binding.method,binding.user_id);
    if(state.version!==binding.version||['platform','carrier'].includes(entry.role)&&identity.assurance!=='aal2')denied();
    return {id:entry.principalId,active:true,userId:entry.userId,role:entry.role,tenantId:entry.tenantId,fleetId:entry.fleetId,principalId:entry.principalId,permissions:[...entry.permissions]};
   }catch{await sessions.revoke(id).catch(()=>{});return null;}
  },
  async refresh(id){
   // Access-token expiry is the reason to refresh, not a reason to revoke the
   // absolute-lifetime session before its restricted store can claim refresh.
   let tokens,unclaimed=false;
   try{
    if(!opaque(id))denied();
    const binding=await store.binding(id),entry=byId.get(binding?.user_id);
    if(!entry||(await membership(entry)).version!==binding.version)denied();
    const result=await sessions.refresh(id,async refreshToken=>{
     tokens=await provider.refresh(refreshToken);
     const admitted=await admit(tokens.accessToken,binding.method,binding.user_id);
     if(admitted.state.version!==binding.version||['platform','carrier'].includes(entry.role)&&admitted.identity.assurance!=='aal2')denied();
     return tokens;
    });
    // Losing the store's claim is not a failed provider exchange. In particular,
    // it must not revoke the winning concurrent request's pending refresh.
    if(!result){unclaimed=true;denied();}
    if(!await this.session(id))denied();return {ok:true};
   }catch{
    if(!unclaimed&&opaque(id))await sessions.revoke(id).catch(()=>{});
    if(tokens?.accessToken)await provider.logout(tokens.accessToken).catch(()=>{});
    throw Error('UAT_ACCESS_DENIED');
   }
  },
  async sessionForRefresh(id){
   if(!opaque(id))return null;
   try{
    const binding=await store.binding(id),current=await sessions.getForRefresh(id),entry=byId.get(binding?.user_id);
    if(!entry||!current||current.user_id!==entry.userId||(await membership(entry)).version!==binding.version)denied();
    return {id:entry.principalId,active:true,userId:entry.userId,role:entry.role,tenantId:entry.tenantId,fleetId:entry.fleetId,principalId:entry.principalId,permissions:[...entry.permissions]};
   }catch{return null;}
  },
  async logout(id){const current=opaque(id)?await sessions.get(id).catch(()=>null):null;if(opaque(id))await sessions.revoke(id);if(current)await provider.logout(current.access_token).catch(()=>{});return {ok:true};},
  async revoke({adminSession,userId}){const {actor}=await admin(adminSession,userId);await store.revoke(userId,{deactivate:true,actorId:actor.id});return {ok:true};}
 });
}
