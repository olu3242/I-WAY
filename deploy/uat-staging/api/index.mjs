import {randomUUID} from 'node:crypto';
import {createHostedUatRuntime} from '../../../server/operations-uat-hosted-runtime.mjs';
let generation;
export const config={api:{bodyParser:false}};
function retire(state){
 state.retired=true;if(generation===state)generation=undefined;
 if(!state.active&&!state.closing){state.closing=true;void state.ready.then(app=>app.close()).catch(()=>{});}
}
async function acquire(){
 for(let attempt=0;attempt<2;attempt++){
  const state=generation??={active:0,retired:false,ready:createHostedUatRuntime()};
  let app;try{app=await state.ready;}catch{retire(state);throw Error('UAT_UNAVAILABLE');}
  if(state.retired||app.expiresAt<=Date.now()){retire(state);continue;}
  state.active++;return {state,app};
 }
 throw Error('UAT_UNAVAILABLE');
}
export default async function handler(req,res){
 let lease;
 try{
  lease=await acquire();return await lease.app.handler(req,res);
 }catch{
  if(lease)retire(lease.state);
  if(res.headersSent)return res.end();
  const requestId=randomUUID();console.info(JSON.stringify({event:'uat_runtime_unavailable',requestId,status:503}));
  res.writeHead(503,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-request-id':requestId});res.end('{"error":"UAT_UNAVAILABLE"}');
 }finally{if(lease){lease.state.active--;if(lease.state.retired)retire(lease.state);}}
}
