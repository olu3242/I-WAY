// Hosted-only browser lifecycle. Never invoked by default repository CI.
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const origin='https://iway-auth-staging.vercel.app';
const project='prj_7uof3CdmN1QvzKxETkXvHjlrLjVm';
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
export function hostedAuthConfig(env){
 if(env.IWAY_HOSTED_AUTH_APPROVED!=='true'||env.IWAY_HOSTED_SYNTHETIC_ONLY!=='true'||
  env.IWAY_AUTH_ORIGIN!==origin||env.IWAY_STAGING_VERCEL_PROJECT_ID!==project||
  !/^[0-9a-f]{40}$/.test(env.IWAY_HOSTED_COMMIT??'')||
  !uuid(env.IWAY_SYNTHETIC_OWN_RESOURCE)||!uuid(env.IWAY_SYNTHETIC_OTHER_RESOURCE)||
  env.IWAY_SYNTHETIC_OWN_RESOURCE===env.IWAY_SYNTHETIC_OTHER_RESOURCE)
  throw Error('HOSTED_AUTH_PREREQUISITES_MISSING');
 return {origin,project,commit:env.IWAY_HOSTED_COMMIT,own:env.IWAY_SYNTHETIC_OWN_RESOURCE,
  other:env.IWAY_SYNTHETIC_OTHER_RESOURCE,bypass:env.VERCEL_AUTOMATION_BYPASS_SECRET};
}
export async function runHostedAuth({env=process.env,chromium}={}){
 const config=hostedAuthConfig(env);
 const engine=chromium??(await import('@playwright/test')).chromium;
 const evidence={schema:'iway-hosted-auth-v1',project,origin,commit:config.commit,syntheticOnly:true,
  providerInteraction:'operator signs in with approved synthetic account',checks:[],passed:false,
  databasePrivilegeCertification:false,rollbackCertification:false};
 const browser=await engine.launch({headless:false});
 const context=await browser.newContext(); // Never persist storageState, traces, video or screenshots.
 const safeHeaders=config.bypass?{'x-vercel-protection-bypass':config.bypass}:{};
 await context.route(origin+'/**',route=>route.continue({headers:{...route.request().headers(),...safeHeaders}}));
 const page=await context.newPage();
 let callbackUrl,binding;
 page.on('response',response=>{
  const url=new URL(response.url());
  if(url.origin===origin&&url.pathname==='/auth/callback'&&response.status()===303)callbackUrl=response.url();
 });
 const check=(name,actual,expected,elapsedMs)=>{
  const passed=actual===expected;evidence.checks.push({name,status:actual,expected,passed,...(elapsedMs===undefined?{}:{elapsedMs})});
  if(!passed)throw Error('HOSTED_AUTH_CHECK_FAILED');
 };
 const request=async(path,{method='GET',cookie,requestOrigin=origin}={})=>{
  const start=performance.now();
  const response=await context.request.fetch(origin+path,{method,maxRedirects:0,timeout:15000,
   headers:{...safeHeaders,origin:requestOrigin,...(cookie?{cookie}:{})}});
  return {response,elapsed:Math.round(performance.now()-start)};
 };
 try{
  let result=await request('/api/health');check('health',result.response.status(),200,result.elapsed);
  result=await request('/auth/login',{method:'POST',requestOrigin:'https://invalid.example'});check('csrf-login',result.response.status(),403);
  result=await request('/auth/callback?code=synthetic-invalid');check('missing-browser-binding',result.response.status(),401);
  await page.goto(origin+'/api/health',{waitUntil:'domcontentloaded'});
  // A real browser form creates a same-origin POST and follows the real provider redirect.
  const loginResponse=page.waitForResponse(r=>r.url()===origin+'/auth/login'&&r.status()===303,{timeout:30000});
  await page.evaluate(()=>{
   const form=document.createElement('form');form.method='POST';form.action='/auth/login';document.body.append(form);form.submit();
  });
  const pkce=(await (await loginResponse).headersArray()).find(h=>h.name.toLowerCase()==='set-cookie'&&h.value.startsWith('__Host-iway-pkce='))?.value;
  check('pkce-cookie-protections',Boolean(pkce&&/; Secure/.test(pkce)&&/; HttpOnly/.test(pkce)&&/; SameSite=Lax/.test(pkce)&&/; Path=\//.test(pkce)&&! /; Domain=/i.test(pkce)),true);
  binding=pkce.split(';')[0];
  console.log('Complete provider sign-in in the opened browser using only the approved synthetic account.');
  await page.waitForURL(origin+'/auth/session',{timeout:180000});
  check('real-provider-callback',Boolean(callbackUrl),true);
  const session=(await context.cookies(origin)).find(c=>c.name==='__Host-iway-session');
  check('session-cookie-protections',Boolean(session?.secure&&session?.httpOnly&&session?.sameSite==='Lax'&&session?.path==='/'),true);
  const cookie=session.name+'='+session.value;
  result=await request('/auth/session');check('session',result.response.status(),200,result.elapsed);
  result=await request('/api/resources/'+config.own+'/verify');check('own-resource-handler',result.response.status(),200,result.elapsed);
  result=await request('/api/resources/'+config.other+'/verify');check('cross-tenant-denied',result.response.status(),403,result.elapsed);
  result=await request(new URL(callbackUrl).pathname+new URL(callbackUrl).search,{cookie:binding});check('callback-replay',result.response.status(),401);
  result=await request('/auth/refresh',{method:'POST',requestOrigin:'https://invalid.example'});check('csrf-refresh',result.response.status(),403);
  result=await request('/auth/refresh',{method:'POST'});check('refresh',result.response.status(),200,result.elapsed);
  result=await request('/auth/session');check('post-refresh-session',result.response.status(),200);
  result=await request('/auth/logout',{method:'POST'});check('logout',result.response.status(),200,result.elapsed);
  result=await request('/auth/session',{cookie});check('revoked-session',result.response.status(),401);
  evidence.passed=true;
 }catch{evidence.passed=false;}
 finally{
  // Best-effort local/provider revocation on interrupted tests. Never emit response bodies or URLs with codes.
  await request('/auth/logout',{method:'POST'}).catch(()=>{});
  await context.close();await browser.close();
 }
 return evidence;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const evidence=await runHostedAuth();
  if(process.env.IWAY_HOSTED_EVIDENCE_PATH)await writeFile(process.env.IWAY_HOSTED_EVIDENCE_PATH,JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify(evidence));if(!evidence.passed)process.exitCode=1;
 }catch{console.error('HOSTED_AUTH_NOT_RUN_OR_UNAVAILABLE');process.exitCode=1;}
}
