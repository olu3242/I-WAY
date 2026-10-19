import {createOperationsAdmin} from './operations-admin.mjs';
import {observeRequest} from './operations-observability.mjs';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname} from 'node:path';
import {securityHeaders} from './security-headers.mjs';
import {authenticate,session,logout} from './operations-auth.mjs';
import {readDocument} from '../domain/operations-documents.mjs';
import {OpsError,fields} from '../domain/operations-errors.mjs';
const assets=new Map([['/login','login.html'],['/app','index.html'],['/portal','index.html'],['/assets/ops.css','ops.css'],['/assets/ops.js','ops.js'],['/assets/extended.js','extended.js'],['/assets/intelligence.js','intelligence.js'],['/assets/login.js','login.js'],['/admin','admin.html'],['/assets/admin.js','admin.js'],['/assets/i-way-logo.svg','i-way-logo.svg']]);
export function makeOperationsApp({store,operations,logSink=()=>{}}){
 const loginAttempts=new Map();
 const admin=createOperationsAdmin(store);
 const server=createServer(async(req,res)=>{
  observeRequest(req,res,{sink:logSink});
  const origin='http://127.0.0.1:'+server.address().port;
  const sendAdmin=result=>send(result.ok?200:({FORBIDDEN:403,INVALID_INPUT:422,CONFLICT:409}[result.code]??400),result);
  const send=(status,data)=>{res.writeHead(status,{...securityHeaders(),'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
  if(req.headers.host!=='127.0.0.1:'+server.address().port)return send(403,{error:'Local host required.'});
  const token=(req.headers.cookie??'').split(';').map(x=>x.trim()).find(x=>x.startsWith('iway_ops='))?.slice(9);
  const auth=session(store,token);
  let path;try{path=new URL(req.url,origin).pathname}catch{return send(400,{error:'Invalid URL.'})}
  const readBody=async()=>{
   if(req.headers['content-type']?.split(';')[0]!=='application/json')throw new OpsError(415,'JSON','JSON required.');
   let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>65536)throw new OpsError(413,'SIZE','Request too large.');}
   try{return JSON.parse(body)}catch{throw new OpsError(400,'JSON','Invalid JSON.')}
  };
  try{
   if(req.method==='POST'){
    if(req.headers.origin!==origin)return send(403,{error:'Same-origin request required.'});
    if(path==='/api/ops/login'){
     const key=req.socket.remoteAddress??'local',now=Date.now();
     const attempts=(loginAttempts.get(key)??[]).filter(t=>t>now-300000);
     if(attempts.length>=8)return send(429,{error:'Too many sign-in attempts. Try again later.'});
     const input=await readBody();fields(input,['username','password']);
     let result;try{result=authenticate(store,input.username,input.password)}catch(e){attempts.push(now);loginAttempts.set(key,attempts);throw e;}
     loginAttempts.delete(key);
     res.setHeader('Set-Cookie','iway_ops='+result.token+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800');
     return send(200,{actor:result.actor,csrf:result.csrf});
    }
    if(!auth)return send(401,{error:'Sign in required.'});
    if(req.headers['x-csrf-token']!==auth.csrf)return send(403,{error:'Session verification failed.'});
    if(path==='/api/ops/logout'){logout(store,token,auth.actor);res.setHeader('Set-Cookie','iway_ops=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return send(200,{ok:true});}
    if(path==='/api/ops/admin/settings'){const input=await readBody();fields(input,['settings','expectedVersion']);return sendAdmin(admin.updateSettings(auth.actor,input.settings,input.expectedVersion));}
    if(path==='/api/ops/admin/items'){const input=await readBody();fields(input,['kind','id','data','expectedVersion']);return sendAdmin(admin.upsert(auth.actor,input.kind,input.id,input.data,input.expectedVersion));}
    if(path==='/api/ops/admin/delete'){const input=await readBody();fields(input,['kind','id','expectedVersion']);return sendAdmin(admin.remove(auth.actor,input.kind,input.id,input.expectedVersion));}
    if(path==='/api/ops/commands')return send(200,operations.execute(auth.actor.id,await readBody()));
    return send(404,{error:'Not found.'});
   }
   if(req.method!=='GET'&&req.method!=='HEAD')return send(405,{error:'Method not allowed.'});
   if(path==='/health'){store.db.prepare('SELECT 1').get();return send(200,{status:'ok',storage:'ready',scope:'local'});}
   if(path==='/api/ops/admin/settings'){if(!auth)return send(401,{error:'Sign in required.'});return sendAdmin(admin.getSettings(auth.actor));}
   if(path==='/api/ops/admin/audit'){if(!auth)return send(401,{error:'Sign in required.'});return sendAdmin(admin.audit(auth.actor));}
   if(path==='/api/ops/admin/items'){if(!auth)return send(401,{error:'Sign in required.'});const kind=new URL(req.url,origin).searchParams.get('kind');return sendAdmin(admin.list(auth.actor,kind));}
   if(path==='/api/ops/health'){if(!auth)return send(401,{error:'Sign in required.'});const health=operations.state(auth.actor.id).workflowHealth;if(!health)return send(403,{error:'Health access is not permitted.'});return send(200,health);}
   if(path.startsWith('/api/ops/documents/')){if(!auth)return send(401,{error:'Sign in required.'});return send(200,readDocument(operations,auth.actor,path.slice('/api/ops/documents/'.length)));}
   if(path==='/api/ops/state'){if(!auth)return send(401,{error:'Sign in required.'});return send(200,{...operations.state(auth.actor.id),csrf:auth.csrf});}
   if(path==='/'){res.writeHead(302,{Location:auth?'/app':'/login',...securityHeaders()});return res.end();}
   if(path==='/portal'&&auth?.actor.role!=='customer')return send(auth?403:401,{error:'Customer access required.'});
   if(path==='/app'&&auth?.actor.role==='customer'){res.writeHead(302,{Location:'/portal',...securityHeaders()});return res.end();}
   if(path==='/admin'&&!auth){res.writeHead(302,{Location:'/login',...securityHeaders()});return res.end();}
   if(path==='/admin'&&admin.getSettings(auth.actor).ok!==true)return send(403,{error:'Administration access denied.'});
   if(path==='/app'&&!auth){res.writeHead(302,{Location:'/login',...securityHeaders()});return res.end();}
   const asset=assets.get(path);if(!asset)return send(404,{error:'Not found.'});
   const body=await readFile(new URL('../apps/operations/'+asset,import.meta.url));
   const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'}[extname(asset)];
   res.writeHead(200,{...securityHeaders(),'Content-Type':type,'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"});res.end(req.method==='HEAD'?undefined:body);
  }catch(e){send(e instanceof OpsError?e.status:503,{error:e instanceof OpsError?e.message:'Operation unavailable.',code:e instanceof OpsError?e.code:'UNAVAILABLE'});}
 });
 return server;
}
