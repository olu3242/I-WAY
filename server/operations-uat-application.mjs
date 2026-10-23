import {makeOperationsApp} from './operations-app.mjs';
import {createUatCandidateHttp} from './operations-uat-http.mjs';
import {createUatOperationsSessionBridge} from './operations-uat-session-bridge.mjs';
const controlScript=`let csrf;const activity=document.querySelector('#activity'),audit=document.querySelector('#audit-action'),logout=document.querySelector('#sign-out');const announce=(text,error=false)=>{activity.setAttribute('role',error?'alert':'status');activity.setAttribute('aria-live',error?'assertive':'polite');activity.textContent=text;activity.focus();};async function identity(){const response=await fetch('/api/ops/session');if(!response.ok)throw Error('Sign in required.');csrf=(await response.json()).csrf;}audit.addEventListener('click',async()=>{audit.disabled=true;try{await identity();const response=await fetch('/api/ops/platform',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify({action:'audit'})});if(!response.ok)throw Error('Administration activity is unavailable. Try again.');announce(JSON.stringify(await response.json(),null,2));}catch{announce('Administration activity is unavailable. Try again.',true);}finally{audit.disabled=false;}});logout.addEventListener('click',async()=>{logout.disabled=true;try{await identity();const response=await fetch('/api/ops/logout',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrf},body:'{}'});if(!response.ok)throw Error();location.assign('/uat/login');}catch{announce('Sign out failed. Try again.',true);logout.disabled=false;}});`;
export function createIntegratedUatApplication({origin,workflow,providerSessions,store,operations,identityVerifier,platformNamespaceId,platformNamespaceVerified=false,googleProvider,transactions,authorizeResource,clock}={}){
 const bridge=createUatOperationsSessionBridge({origin,workflow,providerSessions,store,identityVerifier,platformNamespaceId,platformNamespaceVerified,clock});
 const application=makeOperationsApp({store,operations,identityVerifier,externalSessionBridge:bridge});
 const auth=createUatCandidateHttp({origin,workflow,googleProvider,transactions,authorizeResource,applicationSession:bridge});
 const handler=async(req,res)=>{
  let path;try{path=new URL(req.url,origin).pathname;}catch{res.writeHead(400);return res.end();}
  if(path==='/uat/session'||path==='/uat/refresh'||path.startsWith('/uat/resources/')){
   if(req.headers.host!==new URL(origin).host||!await (path==='/uat/refresh'?bridge.readForRefresh(req):bridge.read(req))){res.writeHead(401,{'cache-control':'no-store','content-type':'application/json'});return res.end('{"error":"ACCESS_DENIED"}');}
  }
  if(path==='/uat/control'||path==='/uat/control.js'){
   if(req.headers.host!==new URL(origin).host){res.writeHead(403,{'cache-control':'no-store'});return res.end('Access denied');}
   const current=await bridge.read(req);if(!current||current.actor.role!=='platform'){res.writeHead(403,{'cache-control':'no-store'});return res.end('Access denied');}
   res.writeHead(200,{'cache-control':'no-store','content-type':path.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','content-security-policy':"default-src 'none'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",'referrer-policy':'no-referrer','x-content-type-options':'nosniff'});
   return res.end(path.endsWith('.js')?controlScript:'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>I-WAY administration</title><a href="#main">Skip to administration</a><main id="main" tabindex="-1"><h1>Platform administration</h1><button id="audit-action">View administration activity</button><button id="sign-out">Sign out</button><pre id="activity" role="status" aria-live="polite" tabindex="-1"></pre></main><script src="/uat/control.js" defer></script></html>');
  }
  if(path==='/'||path==='/app'||path==='/portal'||path==='/admin'||path==='/login'||path.startsWith('/assets/')||path.startsWith('/api/ops/'))return application.emit('request',req,res);
  return auth(req,res);
 };
 return {handler,bridge};
}
