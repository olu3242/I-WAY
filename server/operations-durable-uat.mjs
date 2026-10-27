import {createOwnerProfileHandler} from './operations-owner-profiles.mjs';
import {EventEmitter} from 'node:events';
import {createIntegratedUatApplication} from './operations-uat-application.mjs';
import {createUatCandidateHttp} from './operations-uat-http.mjs';
import {createUatOperationsSessionBridge,clearOperationsCookie} from './operations-uat-session-bridge.mjs';
import {readAuthCookie,SESSION_COOKIE} from './operations-supabase-pkce-session.experimental.mjs';
import {advanceDurableAdvisories} from './operations-durable-worker.mjs';
// Responses cannot escape before the PostgreSQL transaction has committed.
export class TransactionResponse extends EventEmitter{
 constructor(){super();this.statusCode=200;this.headers={};this.chunks=[];this.headersSent=false;this.writableEnded=false;this.size=0;this.finished=new Promise((resolve,reject)=>{this.once('finish',resolve);this.once('error',reject);});}
 setHeader(k,v){this.headers[k.toLowerCase()]=v;return this;}
 getHeader(k){return this.headers[k.toLowerCase()];}
 getHeaders(){return {...this.headers};}
 removeHeader(k){delete this.headers[k.toLowerCase()];}
 writeHead(status,headers={}){this.statusCode=status;for(const [k,v]of Object.entries(headers))this.setHeader(k,v);this.headersSent=true;return this;}
 write(chunk){if(this.failure)return false;if(chunk!==undefined){const b=Buffer.isBuffer(chunk)?chunk:Buffer.from(String(chunk));this.size+=b.length;if(this.size>8388608){this.failure=true;this.chunks=[];this.emit('error',Error('RESPONSE_LIMIT'));return false;}this.chunks.push(b);}return true;}
 end(chunk){this.write(chunk);this.writableEnded=true;this.emit('finish');return this;}
 flush(res){res.writeHead(this.statusCode,this.headers);res.end(Buffer.concat(this.chunks));}
}
export async function createDurableUatApplication({engine,platformNamespaceId,ownerProfiles=[],...dependencies}={}){
 if(!engine||!await engine.validatePlatformNamespace(platformNamespaceId))throw Error('APPROVED_GOVERNANCE_NAMESPACE_REQUIRED');
 const {workflow,origin}=dependencies;
 const scope=parent=>({tenantId:parent.role==='platform'?platformNamespaceId:parent.tenantId,actorId:parent.principalId});
 const inParent=async(id,work,{refresh=false}={})=>{
  const parent=refresh?await workflow.sessionForRefresh(id):await workflow.session(id);
  if(!parent)throw Error('APPROVED_SESSION_REQUIRED');
  return engine.transaction(scope(parent),({store,operations})=>work(createUatOperationsSessionBridge({...dependencies,store,operations,platformNamespaceId,platformNamespaceVerified:true})));
 };
 const facade={origin,clearCookie:clearOperationsCookie,
  establish:(id,previous,options)=>inParent(id,bridge=>bridge.establish(id,previous,options),options),
  read:req=>inParent(readAuthCookie(req.headers,SESSION_COOKIE),bridge=>bridge.read(req)),
  logout:async req=>{const id=readAuthCookie(req.headers,SESSION_COOKIE);try{await inParent(id,bridge=>bridge.logout(req),{refresh:true});}catch{await workflow.logout(id);}}
 };
 const auth=createUatCandidateHttp({...dependencies,applicationSession:facade});
 const handler=async(req,res)=>{
  try{
   if(req.headers.host!==new URL(origin).host){res.writeHead(403,{'cache-control':'no-store'});return res.end();}
   const path=new URL(req.url,origin).pathname;
   if(path==='/health'||path==='/api/health'){
    const health=await engine.health();res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify({status:'ok',storage:health.storage,scope:'protected-preview'}));
   }
   const native=path==='/'||['/offline','/driver-sw.js','/domain/driver-offline-replay.mjs','/app','/portal','/admin','/login','/uat/control','/uat/control.js','/uat/session','/uat/refresh'].includes(path)||path.startsWith('/assets/')||path.startsWith('/api/ops/')||path.startsWith('/uat/resources/');
   if(!native)return auth(req,res);
   const id=readAuthCookie(req.headers,SESSION_COOKIE),parent=path==='/uat/refresh'?await workflow.sessionForRefresh(id):await workflow.session(id);
   if(!parent){
    if(['/','/login','/app','/admin'].includes(path)){res.writeHead(303,{location:'/uat/login','cache-control':'no-store'});return res.end();}
    res.writeHead(401,{'content-type':'application/json','cache-control':'no-store'});return res.end('{"error":"AUTH_REQUIRED"}');
   }
   const buffered=new TransactionResponse();
   await engine.transaction(scope(parent),async({store,operations})=>{
    const app=createIntegratedUatApplication({...dependencies,store,operations,platformNamespaceId,platformNamespaceVerified:true});
    await app.handler(req,buffered);await buffered.finished;
    if(path==='/api/ops/commands'&&req.method==='POST'&&buffered.statusCode<400&&['carrier','dispatcher'].includes(parent.role)&&parent.permissions.some(p=>['workflow:run','orchestration:manage'].includes(p)))await advanceDurableAdvisories(operations,{limit:5});
    if(buffered.statusCode<400&&!['/api/ops/logout'].includes(path)&&!await workflow.session(id))throw Error('AUTHORITY_CHANGED_BEFORE_COMMIT');
   });
   if(!req.aborted&&!res.destroyed)buffered.flush(res);
  }catch{if(!res.headersSent){res.writeHead(503,{'content-type':'application/json','cache-control':'no-store'});res.end('{"error":"UNAVAILABLE"}');}else res.destroy();}
 };
 return {handler:createOwnerProfileHandler({baseHandler:handler,engine,platformNamespaceId,ownerProfiles,...dependencies})};
}
