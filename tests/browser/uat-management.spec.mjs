// Synthetic delivery links and identities only. No external browser/provider access.
import {test,expect,axeAccessibility} from './workspace.mjs';
import {createServer,request as httpRequest} from 'node:http';
import {randomUUID} from 'node:crypto';
import {uatApplicationFixture} from '../helpers/uat-application-fixture.mjs';
import {managementFixture} from '../helpers/uat-management-fixture.mjs';
import {syntheticPassword} from '../helpers/uat-fixture.mjs';
for(const width of [390,1440])for(const role of ['platform','carrier','fleet','driver'])test(`managed invitation ${role} activation and recovery at ${width}`,async({browser})=>{
 const cleanup=[],f=await uatApplicationFixture({after:fn=>cleanup.push(fn)},{fullPermissions:true});
 const m=managementFixture(f.uat),entry=f.roster.find(e=>e.role===role),input={adminSession:'synthetic-approved-admin',userId:entry.userId,idempotencyKey:randomUUID()};
 const server=createServer((req,res)=>f.integrated.handler(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await context.route(f.origin+'/**',async route=>{
  const request=route.request(),url=new URL(request.url());
  const response=await new Promise((resolve,reject)=>{
   const req=httpRequest({host:'127.0.0.1',port:server.address().port,path:url.pathname+url.search,method:request.method(),headers:{...request.headers(),host:url.host,origin:f.origin}},res=>{
    const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,headers:Object.fromEntries(Object.entries(res.headers).map(([k,v])=>[k,Array.isArray(v)?v.join('\n'):String(v)])),body:Buffer.concat(chunks)}));
   });req.on('error',reject);req.end(request.postData()??undefined);
  });
  for(const name of ['transfer-encoding','connection','keep-alive','content-length'])delete response.headers[name];
  await route.fulfill(response);
 });
 async function sessionStatus(){
  const cookie=(await context.cookies(f.origin)).map(c=>c.name+'='+c.value).join('; ');
  return new Promise((resolve,reject)=>{
   const req=httpRequest({host:'127.0.0.1',port:server.address().port,path:'/api/ops/session',headers:{host:new URL(f.origin).host,cookie}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end();
  });
 }
 async function setup(){
  await page.goto(f.origin+'/uat/setup#'+f.uat.mail.at(-1).token);await expect(page).toHaveURL(f.origin+'/uat/setup');
  await page.getByLabel('New password').fill(syntheticPassword);await page.getByRole('button',{name:'Set password',exact:true}).press('Enter');await expect(page.getByRole('status')).toContainText('Password set');
  await expect(page.getByLabel('New password')).toHaveValue('');
 }
 async function login(){
  await page.goto(f.origin+'/uat/login');await page.getByLabel('Email',{exact:true}).fill(entry.email);await page.getByLabel('Password',{exact:true}).fill(syntheticPassword);await page.getByRole('button',{name:'Sign in',exact:true}).press('Enter');
  if(['platform','carrier'].includes(role)){await expect(page.getByLabel('Authenticator code')).toBeVisible();await page.getByLabel('Authenticator code').fill('123456');await page.getByRole('button',{name:'Verify',exact:true}).press('Enter');}
  await expect(page).toHaveURL(f.origin+(role==='platform'?'/uat/control':'/app'));
 }
 try{
  await expect(m.plane.issue({...input,adminSession:'unapproved'})).rejects.toThrow();expect(m.messages).toHaveLength(0);
  await m.plane.issue(input);await m.plane.issue(input);expect(m.messages).toHaveLength(1);
  await page.goto(f.origin+'/uat/setup#'+f.uat.mail.at(-1).token);await expect(page).toHaveURL(f.origin+'/uat/setup');
  await axeAccessibility(page,role+'-managed-password-setup');
  await setup();await login();await expect(page.locator('h1')).toBeVisible();await axeAccessibility(page,role+'-managed-workspace');
  const actor=await page.evaluate(async()=>{const r=await fetch('/api/ops/session');return (await r.json()).actor;});expect(actor.role).toBe(role);
  if(role!=='platform')expect(await page.evaluate(async()=>{
   const session=await(await fetch('/api/ops/session')).json();
   return (await fetch('/api/ops/platform',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':session.csrf},body:JSON.stringify({action:'audit'})})).status;
  })).toBe(403);
  await m.plane.issue({...input,idempotencyKey:randomUUID(),purpose:'recovery'});
  expect(await sessionStatus()).toBe(401);
  await setup();await login();
  expect((await context.cookies(f.origin)).filter(c=>c.name.includes('iway')).every(c=>c.httpOnly)).toBe(true);
  await m.plane.revoke({...input,idempotencyKey:randomUUID()});expect(await sessionStatus()).toBe(401);
  expect(errors).toEqual([]);
 }finally{await context.close();server.closeAllConnections();await new Promise(r=>server.close(r));for(const fn of cleanup.reverse())await fn();}
});
