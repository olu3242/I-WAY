import {test,expect,axeAccessibility} from './workspace.mjs';
import {trackControls,verifiedOutcome} from './control-evidence.mjs';
import {createServer,request as httpRequest} from 'node:http';
import {uatApplicationFixture} from '../helpers/uat-application-fixture.mjs';
// Synthetic HTTPS browser origin forwarded into loopback; no external OAuth or mail.
for(const width of [390,1440])for(const role of ['platform','carrier','fleet','driver'])test(`integrated ${role} application lifecycle at ${width}`,async({browser})=>{
 test.setTimeout(180000);
 const cleanup=[],f=await uatApplicationFixture({after:fn=>cleanup.push(fn)},{fullPermissions:true});f.setLoginRole(role);
 const server=createServer(f.integrated.handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));
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
  await page.goto(f.origin+'/uat/login');await page.getByRole('button',{name:'Continue with Google'}).click();
  await verifiedOutcome('button:Continue with Google',async()=>{await expect(page).toHaveURL(f.origin+(role==='platform'?'/uat/control':'/app'));});
  await expect(page.locator('h1')).toBeVisible();
  const state=await page.evaluate(async()=>{const r=await fetch('/api/ops/session');return {status:r.status,body:await r.json()};});
  expect(state.status).toBe(200);expect(state.body.actor.role).toBe(role);
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
  const refresh=await page.evaluate(async()=>{const r=await fetch('/uat/refresh',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});return r.status;});expect(refresh).toBe(200);
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await verifiedOutcome('button:Sign out',async()=>{await expect(page).toHaveURL(f.origin+'/uat/login');});
  const after=await page.evaluate(async()=> (await fetch('/api/ops/session')).status);expect(after).toBe(401);expect(errors).toEqual([]);
 }finally{await context.close();server.closeAllConnections();await new Promise(r=>server.close(r));for(const fn of cleanup.reverse())await fn();}
});
