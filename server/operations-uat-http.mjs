// Opt-in staging candidate; no route is installed in the deployed application.
import {createSupabaseLogin,createSupabasePkceCallback} from './operations-supabase-pkce-callback-flow.experimental.mjs';
import {readAuthCookie,SESSION_COOKIE,sessionCookie,clearSessionCookie,clearPkceCookie} from './operations-supabase-pkce-session.experimental.mjs';
const mfaCookie='__Host-iway-uat-mfa';
const pendingCookie=value=>`${mfaCookie}=${value}; Path=/; Max-Age=300; HttpOnly; Secure; SameSite=Strict`;
const clearPending=()=>`${mfaCookie}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
const script=`
const setup=location.pathname==='/uat/setup';
let invitation='';
function captureInvitation(){
 if(!setup)return;
 const next=location.hash.slice(1);invitation=/^[A-Za-z0-9_-]{43}$/.test(next)?next:'';
 history.replaceState(null,'',location.pathname);
 document.querySelector('#credentials').reset();document.querySelector('#status').textContent='';
}
if(setup){captureInvitation();addEventListener('hashchange',captureInvitation);}
const status=document.querySelector('#status');
if(!setup&&location.hash==='#mfa'){history.replaceState(null,'',location.pathname);document.querySelector('#mfa').hidden=false;status.textContent='Enter your authenticator code.';}
document.querySelector('#credentials').addEventListener('submit',async event=>{
 event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;
 const values=new FormData(form);
 try{
  const body=setup?{token:invitation,password:values.get('password')}:{email:values.get('email'),password:values.get('password')};
  const response=await fetch(setup?'/uat/setup':'/uat/password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json();
  status.textContent=response.ok?(data.mfaRequired?'Enter your authenticator code.':setup?'Password set. Return to sign in.':'Signed in.'):'Sign-in or setup could not be completed.';
  if(data.mfaRequired)document.querySelector('#mfa').hidden=false;
  if(setup&&response.ok)invitation='';
  if(response.ok&&['/app','/uat/control'].includes(data.next))location.assign(data.next);
 }catch{status.textContent='Unable to continue.';}
 finally{form.querySelector('[name=password]').value='';button.disabled=false;}
});
document.querySelector('#mfa').addEventListener('submit',async event=>{
 event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;
 const code=new FormData(form).get('code');
 try{
  const response=await fetch('/uat/mfa',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code})});
  status.textContent=response.ok?'Signed in.':'Authentication could not be completed.';
  const data=await response.json();if(response.ok&&['/app','/uat/control'].includes(data.next))location.assign(data.next);
 }catch{status.textContent='Unable to continue.';}
 finally{form.reset();button.disabled=false;}
});`;
function page(setup){return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>I-WAY UAT sign in</title><main><h1>${setup?'Set your I-WAY password':'I-WAY UAT sign in'}</h1><p>Access is limited to approved testers. Recovery requires your UAT administrator.</p>${setup?'':'<form action="/auth/login" method="post"><button>Continue with Google</button></form>'}<form id="credentials">${setup?'':'<label>Email <input name="email" type="email" autocomplete="username" required></label>'}<label>${setup?'New password':'Password'} <input name="password" type="password" autocomplete="${setup?'new-password':'current-password'}" ${setup?'minlength="15"':''} maxlength="128" required></label><button>${setup?'Set password':'Sign in'}</button></form><form id="mfa" hidden><label>Authenticator code <input name="code" inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code" required></label><button>Verify</button></form><p id="status" role="status" aria-live="polite"></p><a href="/uat/login">Return to sign in</a></main><script src="/uat/client.js" defer></script></html>`;}
export function createUatCandidateHttp({origin,workflow,googleProvider,transactions,authorizeResource,applicationSession}={}){
 if(new URL(origin).origin!==origin||!origin.startsWith('https://')||!workflow||![googleProvider?.authorizationUrl,googleProvider?.exchangeCode,transactions?.save,transactions?.consume,authorizeResource].every(f=>typeof f==='function'))throw Error('UAT_HTTP_DEPENDENCIES_REQUIRED');
 const login=createSupabaseLogin({saveTransaction:transactions.save,consumeTransaction:transactions.consume,authorizationUrl:googleProvider.authorizationUrl});
 return async function handle(req,res){
  function respond(status,body,headers={}){if(status>=400)res.shouldKeepAlive=false;res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff',...(status>=400?{connection:'close'}:{}),'content-security-policy':"default-src 'none'; script-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",...headers});res.end(typeof body==='string'?body:JSON.stringify(body));}
  async function finish(result,{redirect=false}={}){
   const previous=readAuthCookie(req.headers,SESSION_COOKIE);
   let applicationCookie;
   try{
    if(previous){if(applicationSession)await applicationSession.logout(req);else await workflow.logout(previous);}
    await workflow.cancelMfa(readAuthCookie(req.headers,mfaCookie));
    if(result.id&&applicationSession)applicationCookie=await applicationSession.establish(result.id);
   }catch{if(result.id)await workflow.logout(result.id).catch(()=>{});if(result.pending)await workflow.cancelMfa(result.pending).catch(()=>{});throw Error('UAT_SESSION_REPLACEMENT_FAILED');}
   if(req.aborted){if(result.id)await workflow.logout(result.id);if(result.pending)await workflow.cancelMfa(result.pending);return;}
   const next=applicationSession?(result.mfaRequired?'/uat/login#mfa':(await workflow.session(result.id))?.role==='platform'?'/uat/control':'/app'):null;
   const cookies=result.mfaRequired?[pendingCookie(result.pending),clearSessionCookie(),clearPkceCookie(),...(applicationSession?[applicationSession.clearCookie]:[])]:[sessionCookie({value:result.id}),clearPending(),clearPkceCookie(),...(applicationCookie?[applicationCookie]:[])];
   return respond(redirect&&next?303:200,result.mfaRequired?{mfaRequired:true}:{ok:true,...(next?{next}:{})},{'set-cookie':cookies,...(redirect&&next?{location:next}:{})});
  }
  try{
   if(typeof req.url!=='string'||req.url.length>4096||!req.url.startsWith('/')||req.url.startsWith('//')||req.url.includes('#'))return respond(404,{error:'NOT_FOUND'});
   const url=new URL(req.url,origin),path=url.pathname;
   const critical=new Set(['host','cookie','origin','content-length','transfer-encoding','sec-fetch-site']),seen=new Set();
   for(let i=0;i<(req.rawHeaders?.length??0);i+=2){const name=req.rawHeaders[i].toLowerCase();if(critical.has(name)&&seen.has(name))return respond(400,{error:'INVALID_REQUEST'});seen.add(name);}
   if(url.search&&path!=='/auth/callback')return respond(400,{error:'INVALID_REQUEST'});
   if(!['GET','POST'].includes(req.method))return respond(405,{error:'METHOD_NOT_ALLOWED'});
   if(req.method==='POST'&&(req.headers.origin!==origin||![undefined,'same-origin'].includes(req.headers['sec-fetch-site'])))return respond(403,{error:'ACCESS_DENIED'});
   const network=req.socket?.remoteAddress??'unknown'; // No untrusted forwarding-header rate-limit identity.
   if(req.method==='GET'){
    if(path==='/uat/login'||path==='/uat/setup')return respond(200,page(path==='/uat/setup'),{'content-type':'text/html; charset=utf-8'});
    if(path==='/uat/client.js')return respond(200,script,{'content-type':'text/javascript; charset=utf-8'});
    if(path==='/auth/callback'){
     let result;
     const callback=createSupabasePkceCallback({expectedOrigin:origin,consumeTransaction:transactions.consume,exchangeCode:googleProvider.exchangeCode,
      createSession:async tokens=>{result=await workflow.googleSession(tokens,{network});return {id:result.id??result.pending};}});
     const response=await callback({url:origin+req.url,headers:req.headers});
     if(!response.ok)return respond(401,{error:'ACCESS_DENIED'},{'set-cookie':clearPkceCookie()});
     return await finish(result,{redirect:!!applicationSession});
    }
    const current=await workflow.session(readAuthCookie(req.headers,SESSION_COOKIE));
    if(!current)return respond(401,{error:'AUTH_REQUIRED'});
    if(path==='/uat/session')return respond(200,{authenticated:true,role:current.role});
    const resource=/^\/uat\/resources\/([0-9a-f-]{36})$/i.exec(path);
    if(resource){const allowed=await authorizeResource({actor:current,resourceId:resource[1]});return respond(allowed?200:403,allowed?{ok:true}:{error:'ACCESS_DENIED'});}
    return respond(404,{error:'NOT_FOUND'});
   }
   if(path==='/auth/login'){
    if(req.headers['transfer-encoding']||![undefined,'0'].includes(req.headers['content-length']))return respond(413,{error:'PAYLOAD_NOT_ALLOWED'});
    await workflow.beginGoogle({network});
    const result=await login({headers:req.headers});return respond(result.ok?303:503,{ok:result.ok},{...(result.ok?{location:result.location}:{}),'set-cookie':result.cookie});
   }
   if(!['/uat/password','/uat/setup','/uat/mfa','/uat/refresh','/uat/logout'].includes(path))return respond(404,{error:'NOT_FOUND'});
   if(req.headers['transfer-encoding']||req.headers['content-type']!=='application/json'||!/^[0-9]+$/.test(req.headers['content-length']??'')||Number(req.headers['content-length'])>4096)return respond(413,{error:'PAYLOAD_REJECTED'});
   let chunks=[],size=0,timer;
   const read=async()=>{for await(const chunk of req){size+=chunk.length;if(size>4096)throw Error('BODY_TOO_LARGE');chunks.push(chunk);}};
   try{await Promise.race([read(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('BODY_TIMEOUT')),3000);})]);}finally{clearTimeout(timer);}
   const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   if(!body||typeof body!=='object'||Array.isArray(body))return respond(400,{error:'INVALID_REQUEST'});
   if(path==='/uat/password')return await finish(await workflow.passwordLogin({email:body.email,password:body.password,network}));
   if(path==='/uat/setup')return respond(200,await workflow.setup({token:body.token,password:body.password,network}));
   if(path==='/uat/mfa')return await finish(await workflow.completeMfa({pending:readAuthCookie(req.headers,mfaCookie),code:body.code,network}));
   const id=readAuthCookie(req.headers,SESSION_COOKIE);
   if(path==='/uat/refresh'){
    const result=await workflow.refresh(id);
    try{const cookie=applicationSession?await applicationSession.establish(id,readAuthCookie(req.headers,'iway_ops'),{refresh:true}):null;return respond(200,result,cookie?{'set-cookie':cookie}:{});}
    catch{await workflow.logout(id);return respond(401,{error:'ACCESS_DENIED'});}
   }
   try{await workflow.cancelMfa(readAuthCookie(req.headers,mfaCookie));}
   finally{if(applicationSession)await applicationSession.logout(req);else await workflow.logout(id);}
   return respond(200,{ok:true},{'set-cookie':[clearSessionCookie(),clearPending(),clearPkceCookie(),...(applicationSession?[applicationSession.clearCookie]:[])]});
  }catch{return respond(401,{error:'ACCESS_DENIED'});}
 };
}
