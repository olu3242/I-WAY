// Explicit disposable PostgreSQL + real Chromium journey. OAuth is a local synthetic provider.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {uatApplicationFixture} from '../helpers/uat-application-fixture.mjs';
import {durablePostgresFixture,durableUatFixture} from '../helpers/durable-uat-fixture.mjs';
test('four-step browser submission persists through a restricted PostgreSQL application restart',{timeout:180000},async t=>{
 const pg=await durablePostgresFixture();t.after(()=>pg.close());
 const cleanup=[],f=await uatApplicationFixture({after:fn=>cleanup.push(fn)},{fullPermissions:true});t.after(async()=>{for(const fn of cleanup.reverse())await fn();});f.setLoginRole('carrier');
 let application=await durableUatFixture(f,pg);
 const server=createServer((req,res)=>application.handler(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();return new Promise(r=>server.close(r));});
 const browser=await chromium.launch();t.after(()=>browser.close());const context=await browser.newContext({viewport:{width:390,height:1000}}),page=await context.newPage(),errors=[],scans=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{
  const incoming=route.request(),url=new URL(incoming.url());assert.equal(url.origin,f.origin,'External fixture request denied');
  const response=await new Promise((resolve,reject)=>{const req=request({host:'127.0.0.1',port:server.address().port,path:url.pathname+url.search,method:incoming.method(),headers:{...incoming.headers(),host:url.host,origin:f.origin}},res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>resolve({status:res.statusCode,headers:Object.fromEntries(Object.entries(res.headers).map(([k,v])=>[k,Array.isArray(v)?v.join('\n'):String(v)])),body:Buffer.concat(chunks)}));});req.on('error',reject);req.end(incoming.postData()??undefined);});
  for(const name of ['transfer-encoding','connection','keep-alive','content-length'])delete response.headers[name];
  // Same fixture-only redirect bridge as integrated-workspace; real HTTP 303s have separate tests.
  if(response.status===303){const target=new URL(response.headers.location,f.origin);assert.equal(target.origin,f.origin);response.status=200;response.headers['content-type']='text/html';delete response.headers['content-security-policy'];delete response.headers.location;response.body=Buffer.from('<!doctype html><meta http-equiv="refresh" content="0;url='+target.pathname+target.search+'">');}
  await route.fulfill(response);
 });
 const next=async()=>{await page.getByRole('button',{name:'Next step',exact:true}).click();};
 const scan=async label=>{const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();scans.push({label,violations:result.violations.length,incomplete:result.incomplete.map(r=>r.id)});assert.deepEqual(result.violations,[]);};
 await t.test('actual runtime login has equal session and current users and no privileged role flags',async()=>{const {rows:[r]}=await pg.pool.query('SELECT session_user,current_user,(SELECT rolsuper OR rolbypassrls OR rolinherit FROM pg_roles WHERE rolname=current_user) AS privileged');assert.equal(r.session_user,r.current_user);assert.equal(r.privileged,false);});
 await t.test('synthetic authenticated carrier enters the actual four-step UI',async()=>{await page.goto(f.origin+'/uat/login');await page.getByRole('button',{name:'Continue with Google'}).click();await page.waitForURL(f.origin+'/app');await page.getByRole('button',{name:'Create load',exact:true}).click();await page.getByLabel('Load reference',{exact:true}).fill('ILL PG B681');await page.getByLabel('Customer / broker name').fill('Illustrative PG broker');await page.getByLabel('Commodity',{exact:true}).fill('Illustrative goods');await scan('customer-and-load');await next();});
 await t.test('route and agreed commercial terms pass authoritative restricted transactions',async()=>{await page.getByLabel('Stop 1 location').fill('Illustrative PG pickup');await page.getByLabel('Stop 1 appointment (UTC)').fill('2026-11-02T10:00');await page.getByLabel('Stop 2 location').fill('Illustrative PG delivery');await page.getByLabel('Stop 2 appointment (UTC)').fill('2026-11-03T10:00');await scan('route');await next();await page.getByLabel('Base charge (cents, USD)').fill('12345');await page.getByLabel('Agreed payment terms').fill('Illustrative PG agreement');await scan('commercial');await next();});
 await t.test('review confirms and simultaneous submit events create one load and shipment',async()=>{await page.getByRole('checkbox').check();await scan('review');await page.locator('#load-wizard').evaluate(form=>{form.requestSubmit();form.requestSubmit();});await page.getByRole('heading',{name:'ILL PG B681',exact:true}).waitFor();const result=await page.evaluate(async()=>{const state=await(await fetch('/api/ops/state')).json();const loads=state.loads.filter(l=>l.reference==='ILL PG B681');return {loads,shipments:state.shipments.filter(s=>s.loadId===loads[0]?.id)};});assert.equal(result.loads.length,1);assert.equal(result.shipments.length,1);assert.equal(result.loads[0].rateCents,12345);});
 await t.test('restarted durable application reloads the persisted load detail',async()=>{application={...application,...await application.restart()};await page.reload();await page.getByRole('button',{name:'Loads',exact:true}).click();await page.getByRole('row').filter({hasText:'ILL PG B681'}).getByRole('button',{name:'Open',exact:true}).click();await page.getByRole('heading',{name:'ILL PG B681',exact:true}).waitFor();assert.deepEqual(errors,[]);});
 const output='dist/b681-b690/postgres-browser-wizard';await mkdir(output,{recursive:true});await page.screenshot({path:output+'/persisted-load.png',fullPage:true});await writeFile(output+'/evidence.json',JSON.stringify({status:'PASS',scope:'Disposable PostgreSQL 17 and Chromium; synthetic OAuth only',scenarios:5,scans,consoleErrors:errors,hostedExecuted:0},null,2)+'\n');
});
