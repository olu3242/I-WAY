import {test,expect} from './workspace.mjs';
import {trackControls,verifiedJourney} from './control-evidence.mjs';
import AxeBuilder from '@axe-core/playwright';
import {createServer,request as httpRequest} from 'node:http';
import {syntheticPassword} from '../helpers/uat-fixture.mjs';
import {ownerProfilesFixture} from '../helpers/owner-profiles-fixture.mjs';
import {durablePostgresFixture,durableUatFixture} from '../helpers/durable-uat-fixture.mjs';
const durable=process.env.IWAY_BROWSER_DURABLE_OPT_IN==='true';let postgres;
test.beforeAll(async()=>{if(durable)postgres=await durablePostgresFixture();});
test.afterAll(async()=>{if(postgres)await postgres.close();});
for(const role of ['platform','driver'])for(const width of [390,1440])test(`owner ${role} switches all profiles at ${width}`,async({browser})=>{
 test.setTimeout(180000);const cleanup=[],f=await ownerProfilesFixture({after:fn=>cleanup.push(fn)});f.setLoginRole(role);
 let application=durable?await durableUatFixture(f,postgres):f.app;
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
  if(role==='driver'){
   await f.uat.activate(3);const challenge=f.uat.provider.challengeMfa;f.uat.provider.challengeMfa=async(token,options)=>{expect(options.enroll).toBe(true);return {...await challenge(token),enrollmentSecret:'ABCDEFGHIJKLMNOP'};};
   await page.goto(f.origin+'/uat/login');await page.getByLabel('Email',{exact:true}).fill(f.roster[3].email);await page.getByLabel('Password',{exact:true}).fill(syntheticPassword);await page.getByRole('button',{name:'Sign in',exact:true}).click();
   await expect(page.locator('#enrollment-key')).toContainText('ABCDEFGHIJKLMNOP');await page.getByLabel('Authenticator code').fill('123456');await page.getByRole('button',{name:'Verify',exact:true}).click();
  }else{await page.goto(f.origin+'/uat/login');await page.getByRole('button',{name:'Continue with Google'}).click();}
  await page.getByRole('link',{name:'Switch profile',exact:true}).click();
  await expect(page.getByRole('button',{name:'Switch profile',exact:true})).toBeEnabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  const owner=f.roster.find(e=>e.role===role);
  for(const profile of f.profiles.filter(p=>p.ownerUserId===owner.userId)){
   await page.getByRole('combobox',{name:'Profile',exact:true}).selectOption(profile.principalId);
   await page.getByRole('button',{name:'Switch profile',exact:true}).click();
   await expect(page).toHaveURL(f.origin+(profile.role==='platform'?'/uat/control':'/app'));
   const identity=await page.evaluate(async()=>{const r=await fetch('/api/ops/session');return r.json();});expect(identity.actor.role).toBe(profile.role);expect(identity.actor.ownerUserId).toBe(owner.userId);
   if(durable){const restart=application.restart;application={...await restart(),restart};await page.reload();await expect(page.getByRole('link',{name:'Switch profile',exact:true})).toBeVisible();}
   await verifiedJourney(['form:profile-switch','button:Switch profile'],async()=>{expect(identity.actor.role).toBe(profile.role);});
   await page.getByRole('link',{name:'Switch profile',exact:true}).click();await expect(page.getByRole('button',{name:'Switch profile',exact:true})).toBeEnabled();
  }
  await page.getByRole('link',{name:'Return to workspace'}).click();await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page).toHaveURL(f.origin+'/uat/login');expect(errors).toEqual([]);
 }finally{server.closeAllConnections();await context.close();await new Promise(r=>server.close(r));for(const fn of cleanup)await fn();}
});
