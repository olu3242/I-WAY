import {randomUUID} from 'node:crypto';
const routes=new Map([['/api/health','health'],['/auth/login','login'],['/auth/callback','callback'],['/auth/session','session'],['/auth/refresh','refresh'],['/auth/logout','logout']]);
export function observeAuthRequest(req,res,emit=()=>{}){
 const requestId=randomUUID(),start=performance.now();
 const path=typeof req.url==='string'?req.url.split('?')[0]:'';
 const route=routes.get(path)??(/^\/api\/resources\/[0-9a-f-]{36}\/verify$/i.test(path)?'resource.verify':'unknown');
 let recorded=false;
 function record(status){
  if(recorded)return;recorded=true;
  const event=Object.freeze({event:'auth_http',requestId,route,status:Number.isInteger(status)?status:503,
   durationMs:Math.max(0,Math.round(performance.now()-start))});
  try{emit(event);}catch{} // Telemetry failure must never alter authorization.
 }
 res.once?.('finish',()=>record(res.statusCode));
 res.once?.('close',()=>record(res.writableFinished?res.statusCode:499));
 return {requestId,record};
}
