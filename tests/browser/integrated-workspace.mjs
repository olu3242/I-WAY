// Local synthetic OAuth routed into loopback. Never contacts an identity provider.
import {createServer,request as httpRequest} from 'node:http';
import {uatApplicationFixture} from '../helpers/uat-application-fixture.mjs';
import {durableUatFixture} from '../helpers/durable-uat-fixture.mjs';
import {createHostedUatHandler} from '../../server/operations-uat-hosted-handler.mjs';
import {trackControls} from './control-evidence.mjs';

export async function integratedWorkspace(browser,{role,width,postgres,platformPermissions}={}){
 const cleanup=[],f=await uatApplicationFixture({after:fn=>cleanup.push(fn)},{fullPermissions:true,platformPermissions});
 f.setLoginRole(role);
 let application=postgres?await durableUatFixture(f,postgres):f.integrated;
 const server=createServer(createHostedUatHandler({createRuntime:async()=>({expiresAt:Date.now()+300000,handler:(req,res)=>application.handler(req,res),close:async()=>{}})}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<1000});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin!==f.origin)throw Error('EXTERNAL_FIXTURE_REQUEST_DENIED');
  const response=await new Promise((resolve,reject)=>{
   const req=httpRequest({host:'127.0.0.1',port:server.address().port,path:url.pathname+url.search,method:request.method(),headers:{...request.headers(),host:url.host,origin:f.origin}},res=>{
    const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,headers:Object.fromEntries(Object.entries(res.headers).map(([k,v])=>[k,Array.isArray(v)?v.join('\n'):String(v)])),body:Buffer.concat(chunks)}));
   });req.on('error',reject);req.end(request.postData()??undefined);
  });
  for(const name of ['transfer-encoding','connection','keep-alive','content-length'])delete response.headers[name];
  // A fixture-only refresh starts a new routed navigation after an HTTP 303.
  // The real redirect contract is covered by the HTTP integration suite.
  if(response.status===303){
   const target=new URL(response.headers.location,f.origin);
   if(target.origin!==f.origin)throw Error('EXTERNAL_FIXTURE_REDIRECT_DENIED');
   response.status=200;response.headers['content-type']='text/html';delete response.headers['content-security-policy'];delete response.headers.location;
   response.body=Buffer.from('<!doctype html><meta http-equiv="refresh" content="0;url='+target.pathname+target.search+'">');
  }
  await route.fulfill(response);
 });
 await trackControls(page);
 return {...f,page,context,errors,application,
  restart:async()=>{if(postgres)application={...application,...await application.restart()};},
  close:async()=>{await context.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));for(const fn of cleanup.reverse())await fn();},
 };
}
