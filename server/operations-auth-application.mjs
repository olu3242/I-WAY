import {observeAuthRequest} from './operations-auth-observability.mjs';
// One actual request lifecycle: provider, shared transactions, sessions and private authorization.
import {createSupabaseLogin,createSupabasePkceCallback} from './operations-supabase-pkce-callback-flow.experimental.mjs';
import {readAuthCookie,SESSION_COOKIE,sessionCookie,clearSessionCookie,clearPkceCookie} from './operations-supabase-pkce-session.experimental.mjs';
export function createAuthApplication({origin,provider,transactions,sessions,authorizeResource,observe=()=>{}}={}){
 const parsed=new URL(origin);
 if(parsed.protocol!=='https:'||parsed.origin!==origin||![provider?.authorizationUrl,provider?.exchangeCode,provider?.getUser,provider?.refresh,provider?.logout,transactions?.save,transactions?.consume,sessions?.create,sessions?.get,sessions?.revoke,sessions?.refresh,authorizeResource].every(fn=>typeof fn==='function'))
  throw Error('AUTH_APPLICATION_CONFIGURATION_INVALID');
 const login=createSupabaseLogin({saveTransaction:transactions.save,consumeTransaction:transactions.consume,authorizationUrl:provider.authorizationUrl});
 const callback=createSupabasePkceCallback({expectedOrigin:origin,consumeTransaction:transactions.consume,exchangeCode:provider.exchangeCode,createSession:sessions.create});
 return async function handle(req,res){
  const observation=observeAuthRequest(req,res,observe);
  const respond=(status,body,headers={})=>{
   res.statusCode=status;
   for(const [key,value] of Object.entries({'x-request-id':observation.requestId,'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; frame-ancestors 'none'",...headers}))res.setHeader(key,value);
   if(status>=400){res.shouldKeepAlive=false;res.setHeader('connection','close');}
   res.end(JSON.stringify(body));
   if(!res.once)observation.record(status);
  };
  try{
   const raw=req.url;
   if(req.aborted||typeof raw!=='string'||raw.length>4096||!raw.startsWith('/')||raw.startsWith('//')||raw.includes('#'))return respond(404,{error:'NOT_FOUND'});
   const rawPath=raw.split('?')[0];
   if(!/^\/[a-zA-Z0-9/-]+$/.test(rawPath)||rawPath.includes('//')||rawPath.endsWith('/'))return respond(404,{error:'NOT_FOUND'});
   const url=new URL(raw,origin),method=req.method;
   const critical=new Set(['host','cookie','origin','content-length','transfer-encoding','sec-fetch-site']);
   const seen=new Set();
   for(let i=0;i<(req.rawHeaders?.length??0);i+=2){const key=req.rawHeaders[i].toLowerCase();if(critical.has(key)&&seen.has(key))return respond(400,{error:'INVALID_REQUEST'});seen.add(key);}
   // These endpoints accept no body. Never drain an unauthenticated stream or reuse it.
   if(req.headers?.['transfer-encoding']!==undefined||![undefined,'0'].includes(req.headers?.['content-length']))
    return respond(413,{error:'PAYLOAD_NOT_ALLOWED'});
   if(!['GET','POST'].includes(method))return respond(405,{error:'METHOD_NOT_ALLOWED'});
   if(method==='POST'&&(req.headers?.origin!==origin||![undefined,'same-origin'].includes(req.headers?.['sec-fetch-site'])))
    return respond(403,{error:'ACCESS_DENIED'});
   if(url.pathname!=='/auth/callback'&&url.search)return respond(400,{error:'INVALID_REQUEST'});
   if(method==='GET'&&url.pathname==='/api/health')return respond(200,{ok:true});
   if(method==='POST'&&url.pathname==='/auth/login'){
    const result=await login({headers:req.headers});
    if(!result.ok)return respond(503,{error:'AUTH_UNAVAILABLE'},{'set-cookie':result.cookie});
    return respond(303,{ok:true},{location:result.location,'set-cookie':result.cookie});
   }
   if(method==='GET'&&url.pathname==='/auth/callback'){
    const result=await callback({url:origin+raw,headers:req.headers});
    if(!result.ok)return respond(401,{error:'AUTH_CALLBACK_REJECTED'},{'set-cookie':clearPkceCookie()});
    if(req.aborted){await sessions.revoke(result.sessionId);return;}
    // Reauthentication replaces, rather than fixes, any previous browser session.
    const previous=readAuthCookie(req.headers,SESSION_COOKIE);
    if(previous){try{await sessions.revoke(previous);}catch{await sessions.revoke(result.sessionId).catch(()=>{});return respond(503,{error:'AUTH_UNAVAILABLE'},{'set-cookie':clearPkceCookie()});}}
    return respond(303,{ok:true},{location:'/auth/session','set-cookie':[sessionCookie({value:result.sessionId}),clearPkceCookie()]});
   }
   const sessionId=readAuthCookie(req.headers,SESSION_COOKIE);
   if(!sessionId)return respond(401,{error:'AUTH_REQUIRED'});
   if(method==='POST'&&url.pathname==='/auth/logout'){
    let current;try{current=await sessions.get(sessionId);}catch{}
    await sessions.revoke(sessionId);
    if(current)await provider.logout(current.access_token).catch(()=>{});
    return respond(200,{ok:true},{'set-cookie':[clearSessionCookie(),clearPkceCookie()]});
   }
   if(method==='POST'&&url.pathname==='/auth/refresh'){
    const result=await sessions.refresh(sessionId,provider.refresh);
    if(!result)return respond(409,{error:'SESSION_NOT_REFRESHABLE'});
    return respond(200,{ok:true},{'set-cookie':sessionCookie({value:result.id,maxAge:Math.min(result.maxAge,3600)})});
   }
   if(method!=='GET')return respond(404,{error:'NOT_FOUND'});
   const current=await sessions.get(sessionId);
   if(!current)return respond(401,{error:'AUTH_REQUIRED'});
   const user=await provider.getUser(current.access_token);
   if(!user?.id||user.id!==current.user_id)return respond(403,{error:'ACCESS_DENIED'});
   if(req.aborted)return;
   if(url.pathname==='/auth/session')return respond(200,{authenticated:true});
   const match=/^\/api\/resources\/([0-9a-f-]{36})\/verify$/i.exec(url.pathname);
   if(!match)return respond(404,{error:'NOT_FOUND'});
   const allowed=await authorizeResource({userId:user.id,resourceId:match[1]});
   if(!allowed||req.aborted)return respond(403,{error:'ACCESS_DENIED'});
   return respond(200,{ok:true});
  }catch{return respond(503,{error:'AUTH_UNAVAILABLE'});}
 };
}
