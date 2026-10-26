import {createHash,randomBytes} from 'node:crypto';
import {advanceDurableAdvisories} from './operations-durable-worker.mjs';
import {rolePermissions} from '../domain/authorization.mjs';
import {authenticateOwnerProfile,verifyIdentityProof} from './operations-identity.mjs';
import {createUatOperationsSessionBridge} from './operations-uat-session-bridge.mjs';
import {createIntegratedUatApplication} from './operations-uat-application.mjs';
import {TransactionResponse} from './operations-durable-uat.mjs';
import {readAuthCookie,SESSION_COOKIE} from './operations-supabase-pkce-session.experimental.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex');
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const opaque=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v);
const cookie='__Host-iway-profile';
const labels={platform:'Platform Admin',carrier:'Carrier Admin',fleet:'Fleet Company',driver:'Driver'};
const fail=()=>{throw Error('OWNER_PROFILE_DENIED');};
export function validateOwnerProfiles(profiles,roster,namespace){
 if(profiles===undefined)return Object.freeze([]);
 if(!Array.isArray(profiles)||profiles.length!==8)fail();
 const owners=roster.filter(e=>['platform','driver'].includes(e.role));
 for(const owner of owners){const entries=profiles.filter(p=>p.ownerUserId===owner.userId);if(entries.length!==4||new Set(entries.map(p=>p.role)).size!==4)fail();}
 if(new Set(profiles.map(p=>p.principalId)).size!==8)fail();
 for(const p of profiles){
  const owner=owners.find(e=>e.userId===p.ownerUserId),model=roster.find(e=>e.role===p.role);
  if(!owner||!model||!uuid(p.principalId)||p.tenantId!==(p.role==='platform'?namespace:model.tenantId)||p.fleetId!==model.fleetId||!Array.isArray(p.permissions)||p.permissions.length<1||new Set(p.permissions).size!==p.permissions.length||p.permissions.some(x=>!rolePermissions[p.role].includes(x))||roster.some(e=>e.principalId===p.principalId&&e.userId!==p.ownerUserId))fail();
 }
 return Object.freeze(profiles.map(p=>Object.freeze({...p,permissions:Object.freeze([...p.permissions])})));
}
const page=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Switch profile | I-WAY</title><link rel="stylesheet" href="/uat/styles.css"></head><body><div class="shell"><header class="brand"><img src="/uat/brand.svg" alt="I-way" width="160"><span class="badge">PLATFORM OWNER</span></header><main class="layout"><section class="intro"><h2>Your workspace,<br>your profile.</h2><p>Choose the role you need. Each profile has its own permissions and work history.</p></section><section class="panel"><h1>Switch profile</h1><p class="description">Save any unfinished work before switching. Actions remain attributed to your owner account.</p><form id="profile-switch"><label for="profile">Profile</label><select id="profile" name="profile" required></select><button disabled>Switch profile</button></form><p id="status" role="status" aria-live="polite">Loading your profiles…</p><a class="back" id="back" href="/app">Return to workspace</a></section></main></div><script src="/uat/profiles/client.js" defer></script></body></html>`;
const script=`const form=document.querySelector('#profile-switch'),status=document.querySelector('#status');let csrf;async function load(){try{const r=await fetch('/uat/profiles/session');if(!r.ok)throw Error();const data=await r.json();csrf=data.csrf;for(const p of data.profiles){const o=document.createElement('option');o.value=p.id;o.textContent=p.label;o.selected=p.id===data.current;form.profile.append(o);}document.querySelector('#back').href=data.next;form.querySelector('button').disabled=false;status.textContent='Current profile: '+data.profiles.find(p=>p.id===data.current).label;}catch{status.textContent='Profile access is unavailable. Sign in with your owner account and complete MFA.';}}form.addEventListener('submit',async e=>{e.preventDefault();const b=form.querySelector('button');b.disabled=true;status.textContent='Switching profile…';try{const r=await fetch('/uat/profiles/switch',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify({profileId:form.profile.value})});const data=await r.json();if(!r.ok)throw Error();if(['/app','/uat/control'].includes(data.next))location.assign(data.next);}catch{status.textContent='Profile could not be changed. Reload the page and try again.';b.disabled=false;}});load();`;
export function createOwnerProfileHandler({baseHandler,engine,platformNamespaceId,ownerProfiles=[],...dependencies}){
 if(!ownerProfiles.length)return baseHandler;
 const {origin,workflow,providerSessions,identityVerifier}=dependencies;
 const scope=p=>({tenantId:p.role==='platform'?platformNamespaceId:p.tenantId,actorId:p.principalId});
 const home=(parent,work)=>engine.transaction(scope(parent),({store,operations})=>work({store,operations,bridge:createUatOperationsSessionBridge({...dependencies,store,operations,platformNamespaceId,platformNamespaceVerified:true})}));
 function send(res,status,body,headers={}){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",...headers});res.end(typeof body==='string'?body:JSON.stringify(body));}
 function banner(buffer,role){if(buffer.statusCode!==200||!String(buffer.getHeader('content-type')).includes('text/html'))return;const html=Buffer.concat(buffer.chunks).toString();buffer.chunks=[Buffer.from(html.replace(/<body([^>]*)>/i,`<body$1><nav aria-label="Owner profiles" class="owner-profile-bar"><strong>Platform owner · ${labels[role]}</strong> <a href="/uat/profiles">Switch profile</a></nav>`))];}
 return async(req,res)=>{
  const path=new URL(req.url,origin).pathname;
  const profileRoute=path==='/uat/profiles'||path.startsWith('/uat/profiles/');
  // Authentication/refresh remain owned by the original session workflow.
  const native=path==='/'||['/app','/portal','/admin','/uat/control','/uat/control.js','/offline','/driver-sw.js','/domain/driver-offline-replay.mjs'].includes(path)||path.startsWith('/api/ops/')||path.startsWith('/assets/');
  if(!profileRoute&&!native)return baseHandler(req,res);
  try{
   const critical=new Set(['host','cookie','origin','content-length','transfer-encoding','x-csrf-token']),seen=new Set();for(let i=0;i<(req.rawHeaders?.length??0);i+=2){const name=req.rawHeaders[i].toLowerCase();if(critical.has(name)&&seen.has(name))return send(res,400,{error:'INVALID_REQUEST'});seen.add(name);}
   if(profileRoute&&new URL(req.url,origin).search)return send(res,400,{error:'INVALID_REQUEST'});
   if(req.headers.host!==new URL(origin).host)return send(res,403,{error:'ACCESS_DENIED'});
   if(req.method==='POST'&&(req.headers.origin!==origin||![undefined,'same-origin'].includes(req.headers['sec-fetch-site'])))return send(res,403,{error:'ACCESS_DENIED'});
   const id=readAuthCookie(req.headers,SESSION_COOKIE),parent=await workflow.session(id);
   if(!parent)return profileRoute?send(res,401,{error:'AUTH_REQUIRED'}):baseHandler(req,res);
   const profiles=ownerProfiles.filter(p=>p.ownerUserId===parent.userId);
   if(!profiles.length)return profileRoute?send(res,403,{error:'OWNER_REQUIRED'}):baseHandler(req,res);
   const tokens=await providerSessions.get(id),proof=tokens&&verifyIdentityProof(identityVerifier,tokens.access_token);
   if(!proof||proof.subject!==parent.userId||proof.assurance!=='aal2')return send(res,403,{error:'MFA_REQUIRED'});
   const selectedCookie=readAuthCookie(req.headers,cookie);
   const context=await home(parent,async({store,bridge})=>{
    const auth=await bridge.read(req);if(!auth)fail();
    const selected=store.db.prepare('SELECT * FROM owner_profile_sessions WHERE parent_hash=? AND user_id=?').get(hash(id),parent.principalId);
    if(selected&&(!opaque(selectedCookie)||selected.selection_hash!==hash(selectedCookie)))return {auth,stale:true};
    if(!selected&&selectedCookie)return {auth,stale:true};
    return {auth,selected};
   });
   // The picker is the recovery path for a stale cookie; no operational request
   // can silently fall back to a different role.
   if(context.stale&&!profileRoute&&path!=='/api/ops/logout')return send(res,409,{error:'PROFILE_CHANGED',message:'Open /uat/profiles to choose your profile again.'});
   const selected=profiles.find(p=>p.principalId===(context.selected?.profile_id??parent.principalId));if(!selected&&!context.stale)fail();
   if(profileRoute){
    if(req.method==='GET'&&path==='/uat/profiles')return send(res,200,page,{'content-type':'text/html; charset=utf-8'});
    if(req.method==='GET'&&path==='/uat/profiles/client.js')return send(res,200,script,{'content-type':'text/javascript; charset=utf-8'});
    if(req.method==='GET'&&path==='/uat/profiles/session')return send(res,200,{csrf:context.auth.csrf,current:selected?.principalId??parent.principalId,next:selected?.role==='platform'?'/uat/control':'/app',profiles:profiles.map(p=>({id:p.principalId,label:labels[p.role]}))});
    if(req.method!=='POST'||path!=='/uat/profiles/switch')return send(res,405,{error:'METHOD_NOT_ALLOWED'});
    if(req.headers['x-csrf-token']!==context.auth.csrf||req.headers['content-type']!=='application/json'||req.headers['transfer-encoding']||!/^\d+$/.test(req.headers['content-length']??'')||Number(req.headers['content-length'])>256)return send(res,403,{error:'ACCESS_DENIED'});
    let body='',timer;try{await Promise.race([(async()=>{for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>256)fail();}})(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('TIMEOUT')),3000);})]);}finally{clearTimeout(timer);}
    const input=JSON.parse(body);if(!input||Object.keys(input).join(',')!=='profileId')fail();
    const target=profiles.find(p=>p.principalId===input.profileId);if(!target)return send(res,403,{error:'PROFILE_NOT_GRANTED'});
    if(!await engine.verifyUatEntry({...target,tenantId:target.role==='platform'?null:target.tenantId},platformNamespaceId))fail();
    const selection=randomBytes(32).toString('base64url'),csrf=randomBytes(32).toString('base64url');
    await home(parent,async({store,bridge})=>{
     const auth=await bridge.read(req);if(!auth||auth.csrf!==context.auth.csrf)fail();
     store.db.prepare('INSERT INTO owner_profile_sessions VALUES(?,?,?,?,?) ON CONFLICT(parent_hash) DO UPDATE SET profile_id=excluded.profile_id,selection_hash=excluded.selection_hash,csrf=excluded.csrf').run(hash(id),parent.principalId,target.principalId,hash(selection),csrf);
     store.audit(auth.actor,'profile:switch',target.principalId,'success',{authenticatedOwnerUserId:parent.userId,fromProfileId:selected?.principalId??null,toProfileId:target.principalId,toRole:target.role});
    });
    return send(res,200,{ok:true,next:target.role==='platform'?'/uat/control':'/app'},{'set-cookie':`${cookie}=${selection}; Path=/; Max-Age=28800; HttpOnly; Secure; SameSite=Strict`});
   }
   if(path==='/api/ops/logout'){
    if(req.method!=='POST'||![context.auth.csrf,context.selected?.csrf].filter(Boolean).includes(req.headers['x-csrf-token']))return send(res,403,{error:'ACCESS_DENIED'});
    req.headers['x-csrf-token']=context.auth.csrf;const out=new TransactionResponse();await baseHandler(req,out);await out.finished;const prior=out.getHeader('set-cookie');out.setHeader('set-cookie',[...(Array.isArray(prior)?prior:prior?[prior]:[]),`${cookie}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`]);return out.flush(res);
   }
   if(!context.selected){const buffered=new TransactionResponse();await baseHandler(req,buffered);await buffered.finished;banner(buffered,parent.role);return buffered.flush(res);}
   const buffered=new TransactionResponse();
   await engine.transaction({tenantId:selected.tenantId,actorId:selected.principalId},async({store,operations})=>{
    const actor=store.principal(selected.principalId);if(!actor?.active||actor.ownerUserId!==parent.userId)fail();
    if(['fleet','driver'].includes(selected.role)&&!store.get('fleet',selected.fleetId,selected.tenantId).active)fail();
    if(selected.role==='driver'){const driver=store.get('driver',selected.principalId,selected.tenantId);if(!driver.active||driver.fleetId!==selected.fleetId)fail();}
    const auth=authenticateOwnerProfile(store,identityVerifier,tokens.access_token,{...selected,csrf:context.selected.csrf});
    const sessionBridge={origin,read:async()=>auth,logout:async()=>fail()};
    const app=createIntegratedUatApplication({...dependencies,store,operations,platformNamespaceId,platformNamespaceVerified:true,sessionBridge});
    await app.handler(req,buffered);await buffered.finished;
    if(path==='/api/ops/commands'&&req.method==='POST'&&buffered.statusCode<400&&selected.role==='carrier'&&selected.permissions.some(p=>['workflow:run','orchestration:manage'].includes(p)))await advanceDurableAdvisories(operations,{limit:5});
    if(!await workflow.session(id))fail();
   });
   banner(buffered,selected.role);if(!req.aborted&&!res.destroyed)buffered.flush(res);
  }catch{if(!res.headersSent)send(res,403,{error:'OWNER_PROFILE_DENIED'});else res.destroy();}
 };
}
