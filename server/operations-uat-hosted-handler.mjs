import {randomUUID} from 'node:crypto';

// One pool generation per serverless instance. Retired generations drain before
// closing so key rotation or one failed request cannot interrupt another request.
export function createHostedUatHandler({createRuntime,clock=Date.now,initializationTimeoutMs=20000,logSink=event=>console.info(JSON.stringify(event))}={}){
 if(typeof createRuntime!=='function')throw Error('UAT_RUNTIME_FACTORY_REQUIRED');
 if(!Number.isInteger(initializationTimeoutMs)||initializationTimeoutMs<1||initializationTimeoutMs>60000)throw Error('UAT_INITIALIZATION_TIMEOUT_INVALID');
 let generation;
 function retire(state){
  state.retired=true;if(generation===state)generation=undefined;
  if(!state.active&&!state.closing){state.closing=true;void state.ready.then(app=>app.close()).catch(()=>{});}
 }
 function initialize(){
  const state={active:0,retired:false,ready:Promise.resolve().then(createRuntime)};
  let timer;
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('UAT_INITIALIZATION_TIMEOUT')),initializationTimeoutMs);});
  state.available=Promise.race([state.ready,deadline]).finally(()=>clearTimeout(timer));
  // Keep the original promise for retirement: a late successful initialization
  // must close its pools, never rejoin the current generation.
  return state;
 }
 async function acquire(){
  for(let attempt=0;attempt<2;attempt++){
   // Deferred construction also catches synchronous startup failures and shares
   // initialization across concurrent cold-start requests.
   const state=generation??=initialize();
   let app;try{app=await state.available;}catch{retire(state);throw Error('UAT_UNAVAILABLE');}
   if(state.retired||!Number.isFinite(app.expiresAt)||app.expiresAt<=clock()){retire(state);continue;}
   state.active++;return {state,app};
  }
  throw Error('UAT_UNAVAILABLE');
 }
 return async function handler(req,res){
  let lease;
  try{
   lease=await acquire();return await lease.app.handler(req,res);
  }catch{
   if(lease)retire(lease.state);
   // Never turn a partial success into a completed success after a failure.
   if(res.headersSent){res.destroy();return;}
   if(res.destroyed||req.aborted)return;
   const requestId=randomUUID();
   try{logSink({event:'uat_runtime_unavailable',requestId,status:503});}catch{}
   res.writeHead(503,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-request-id':requestId});
   res.end('{"error":"UAT_UNAVAILABLE"}');
  }finally{if(lease){lease.state.active--;if(lease.state.retired)retire(lease.state);}}
 };
}
