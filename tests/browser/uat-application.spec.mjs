import {test,expect,axeAccessibility} from './workspace.mjs';
import {trackControls,verifiedOutcome} from './control-evidence.mjs';
import {createServer,request as httpRequest} from 'node:http';
import {uatApplicationFixture} from '../helpers/uat-application-fixture.mjs';
import {syntheticPassword} from '../helpers/uat-fixture.mjs';
import {durablePostgresFixture,durableUatFixture} from '../helpers/durable-uat-fixture.mjs';
const durable=process.env.IWAY_BROWSER_DURABLE_OPT_IN==='true';let postgres;
test.beforeAll(async()=>{if(durable)postgres=await durablePostgresFixture();});
test.afterAll(async()=>{if(postgres)await postgres.close();});
// Synthetic HTTPS browser origin forwarded into loopback; no external OAuth or mail.
for(const method of ['google','password'])for(const width of [390,1440])for(const role of ['platform','carrier','fleet','driver'])test(`integrated ${method} ${role} application lifecycle at ${width}`,async({browser})=>{
 test.setTimeout(180000);
 const cleanup=[],f=await uatApplicationFixture({after:fn=>cleanup.push(fn)},{fullPermissions:true});f.setLoginRole(role);
 let application=durable?await durableUatFixture(f,postgres):f.integrated;
 const server=createServer((req,res)=>application.handler(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route(f.origin+'/**',async route=>{
  const incoming=route.request(),url=new URL(incoming.url());
  const result=await new Promise((resolve,reject)=>{const req=httpRequest({host:'127.0.0.1',port:server.address().port,path:url.pathname+url.search,method:incoming.method(),headers:{...incoming.headers(),host:url.host,origin:f.origin}},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,headers:Object.fromEntries(Object.entries(res.headers).map(([k,v])=>[k,Array.isArray(v)?v.join('\n'):String(v)])),body:Buffer.concat(chunks)}));});req.on('error',reject);req.end(incoming.postData()??undefined);});
  for(const name of ['transfer-encoding','connection','keep-alive','content-length'])delete result.headers[name];
  // Playwright does not re-route a fulfilled redirect chain. Turn fixture-only
  // same-origin redirects into a fresh navigation; HTTP tests assert real 303s.
  if(result.status===303){const target=new URL(result.headers.location,f.origin);if(target.origin!==f.origin)throw Error('EXTERNAL_FIXTURE_REDIRECT_DENIED');result.status=200;result.headers['content-type']='text/html';delete result.headers['content-security-policy'];delete result.headers.location;result.body=Buffer.from('<!doctype html><meta http-equiv="refresh" content="0;url='+target.pathname+target.search+'">');}
  await route.fulfill(result);
 });
 try{
  await trackControls(page);
  if(method==='google'){
   await page.goto(f.origin+'/uat/login');await page.getByRole('button',{name:'Continue with Google'}).click();
   await verifiedOutcome('button:Continue with Google',async()=>{await expect(page).toHaveURL(f.origin+(role==='platform'?'/uat/control':'/app'));});
  }else{
   const entry=f.roster.find(e=>e.role===role);await f.uat.workflow.issue({adminSession:'synthetic-approved-admin',userId:entry.userId});
   await page.goto(f.origin+'/uat/setup#'+f.uat.mail[0].token);await expect(page).toHaveURL(f.origin+'/uat/setup');await page.getByLabel('New password').fill(syntheticPassword);await page.getByRole('button',{name:'Set password',exact:true}).click();await expect(page.getByRole('status')).toContainText('Password set');
   await page.getByRole('link',{name:'Return to sign in'}).click();await page.getByLabel('Email',{exact:true}).fill(entry.email);await page.getByLabel('Password',{exact:true}).fill(syntheticPassword);await page.getByRole('button',{name:'Sign in',exact:true}).click();
   if(['platform','carrier'].includes(role)){await expect(page.getByLabel('Authenticator code')).toBeVisible();await page.getByLabel('Authenticator code').fill('123456');await page.getByRole('button',{name:'Verify',exact:true}).click();}
   await expect(page).toHaveURL(f.origin+(role==='platform'?'/uat/control':'/app'));
  }
  await expect(page.locator('h1')).toBeVisible();
  if(durable)application={...application,...await application.restart()};
  if(durable&&method==='google'&&role==='driver'&&width===1440){
   await postgres.pg.admin.query('REVOKE UPDATE(payload,version) ON operations_engine_private.state FROM iway_operations_fixture');
   try{expect(await page.evaluate(async()=>{const r=await fetch('/api/ops/state');return r.status;})).toBe(503);}
   finally{await postgres.pg.admin.query('GRANT UPDATE(payload,version) ON operations_engine_private.state TO iway_operations_fixture');}
  }
  const state=await page.evaluate(async()=>{const r=await fetch('/api/ops/session');return {status:r.status,body:await r.json()};});
  expect(state.status).toBe(200);expect(state.body.actor.role).toBe(role);
  if(durable&&method==='google'&&role==='carrier'&&width===1440){
   const progress=await page.evaluate(async()=>{
    const before=await(await fetch('/api/ops/state')).json(),load=before.loads[0];
    const sent=await fetch('/api/ops/commands',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':before.csrf},body:JSON.stringify({action:'orchestration:request',resourceId:load.id,expectedVersion:load.version,payload:{},idempotencyKey:crypto.randomUUID()})});
    const after=await(await fetch('/api/ops/state')).json();return {status:sent.status,job:after.orchestrations[0]?.status,decisions:after.agentDecisions.length};
   });
   expect(progress).toEqual({status:200,job:'completed',decisions:5});
  }
  if(role==='platform'){
   await axeAccessibility(page,'platform-governance');await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Skip to administration'})).toBeFocused();await page.keyboard.press('Enter');await expect(page.locator('#main')).toBeFocused();
   await page.route('**/api/ops/platform',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));await page.getByRole('button',{name:'View administration activity'}).click();await expect(page.getByRole('alert')).toContainText('Try again');await expect(page.getByRole('alert')).toBeFocused();
   await page.unroute('**/api/ops/platform');await page.getByRole('button',{name:'View administration activity'}).press('Enter');await verifiedOutcome('button:View administration activity',async()=>{await expect(page.locator('#activity')).toContainText('platform:audit');await expect(page.getByRole('button',{name:'View administration activity'})).toBeEnabled();});
  }else{
   const tabs=await page.locator('#nav button').evaluateAll(nodes=>nodes.map(n=>n.dataset.tab));
   for(const id of tabs){await page.locator('#nav [data-tab="'+id+'"]').press('Enter');await verifiedOutcome('navigation:'+id,async()=>{await expect(page.locator('h1')).toBeFocused();await expect(page.locator('#nav [data-tab="'+id+'"]')).toHaveAttribute('aria-current','page');});}
   await axeAccessibility(page,role+'-integrated-workspace');
  }
  expect(await page.evaluate(()=>document.cookie)).not.toContain('iway_ops');
  if(role==='carrier'){await page.goto(f.origin+'/admin');await expect(page.locator('#notice')).toHaveText('Ready');}
  const refresh=await page.evaluate(async()=>{const r=await fetch('/uat/refresh',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});return r.status;});expect(refresh).toBe(200);
  if(role==='carrier'){
   await page.getByLabel('Legal name',{exact:true}).fill('Illustrative refreshed administration');await page.getByRole('button',{name:'Save company settings',exact:true}).click();await expect(page.locator('#notice')).toHaveText('Company settings saved');await page.getByRole('link',{name:'Operations',exact:true}).click();await expect(page.locator('#identity')).toContainText('carrier');
  }
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await verifiedOutcome('button:Sign out',async()=>{await expect(page).toHaveURL(f.origin+'/uat/login');});
  const after=await page.evaluate(async()=> (await fetch('/api/ops/session')).status);expect(after).toBe(401);expect(errors).toEqual([]);
 }finally{await context.close();server.closeAllConnections();await new Promise(r=>server.close(r));for(const fn of cleanup.reverse())await fn();}
});
