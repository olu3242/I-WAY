import {test,expect,axeAccessibility} from './workspace.mjs';
import {integratedWorkspace as createWorkspace} from './integrated-workspace.mjs';
import {durablePostgresFixture} from '../helpers/durable-uat-fixture.mjs';
import {verifiedJourney} from './control-evidence.mjs';
const durable=process.env.IWAY_BROWSER_DURABLE_OPT_IN==='true';let postgres;
test.beforeAll(async()=>{if(durable)postgres=await durablePostgresFixture();});
test.afterAll(async()=>{if(postgres)await postgres.close();});
function integratedWorkspace(browser,options){return createWorkspace(browser,{...options,postgres});}
for(const width of [390,768,1440])for(const role of ['carrier','fleet','driver'])test(`harmonized ${role} dashboard, dispatch filters and bookmarks at ${width}`,async({browser})=>{
 const f=await integratedWorkspace(browser,{role,width}),{page}=f;
 try{
  await page.goto(f.origin+'/uat/login');await page.getByRole('button',{name:'Continue with Google'}).click();await expect(page.locator('#identity')).toContainText(role);
  const data=await page.evaluate(async()=>(await(await fetch('/api/ops/state')).json()));
  const active=data.loads.filter(l=>!['delivered','void'].includes(l.status)).length;
  const name=role==='fleet'?'Active fleet loads':role==='driver'?'Active assignments':'Active loads';
  await expect(page.getByRole('region',{name:'Operational totals'}).locator('.stat').filter({hasText:name}).locator('strong')).toHaveText(String(active));
  if(role==='driver'){await expect(page.locator('.assignment-card')).toHaveCount(active);await expect(page.locator('#view')).not.toContainText('Base charge');}
  await axeAccessibility(page,'dashboard-'+role+'-'+width);await page.screenshot({path:test.info().outputPath('dashboard-'+role+'-'+width+'.png'),fullPage:true});
  await page.getByRole('link',{name:'Open loads',exact:true}).press('Enter');await expect(page).toHaveURL(f.origin+'/app#loads');await expect(page.locator('#nav [data-tab=loads]')).toHaveAttribute('aria-current','page');
  await page.getByLabel('Dispatch stage').selectOption('delivered');await page.getByRole('button',{name:'Search loads',exact:true}).click();await expect(page.locator('#view')).toContainText('0 matching loads');
  await page.getByLabel('Dispatch stage').selectOption('assigned');await page.getByRole('button',{name:'Search loads',exact:true}).click();await expect(page.locator('#view')).toContainText('1 matching loads');
  await page.reload();await expect(page.locator('#nav [data-tab=loads]')).toHaveAttribute('aria-current','page');await expect(page.locator('h1')).toHaveText('Loads');
  await page.getByRole('button',{name:'Open',exact:true}).first().click();await expect(page.locator('.load-phases [aria-current=step]')).toHaveText('assigned');
  const csrf=await page.evaluate(async()=>(await(await fetch('/api/ops/session')).json()).csrf);
  if(role!=='carrier')expect(await page.evaluate(async csrf=>(await fetch('/api/ops/commands',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify({action:'load:create',payload:{},idempotencyKey:crypto.randomUUID()})})).status,csrf)).toBe(403);
  await axeAccessibility(page,'load-detail-'+role+'-'+width);expect(f.errors).toEqual([]);
 }finally{await f.close();}
});
for(const role of ['carrier','fleet'])test('resource search preserves scoped records and approvals for '+role,async({browser})=>{
 const f=await integratedWorkspace(browser,{role,width:390}),{page}=f;
 try{
  await page.goto(f.origin+'/uat/login');await page.getByRole('button',{name:'Continue with Google'}).click();await page.locator('#nav [data-tab=assets]').click();
  await page.getByLabel('Search people & equipment').fill('NO SUCH ILLUSTRATIVE RESOURCE');await page.getByRole('button',{name:'Filter resources',exact:true}).click();
  await verifiedJourney(['form:asset-search','button:Filter resources'],async()=>{await expect(page.locator('#view')).toContainText('No drivers match this view.');await expect(page.getByRole('status')).toContainText('Resource list filtered.');});
  await page.getByLabel('Search people & equipment').fill('');await page.getByLabel('Resource view').selectOption('available');await page.getByRole('button',{name:'Filter resources',exact:true}).click();
  await expect(page.locator('#view')).toContainText('Availability does not replace carrier approval');await axeAccessibility(page,'scoped-resources-'+role);
  await page.screenshot({path:test.info().outputPath('resources-'+role+'-390.png'),fullPage:true});expect(f.errors).toEqual([]);
 }finally{await f.close();}
});
test('initial failed workspace has a keyboard retry and never invents operational totals',async({browser})=>{
 const f=await integratedWorkspace(browser,{role:'carrier',width:390}),{page}=f;let fail=true;
 try{
  await page.route('**/api/ops/state',route=>fail?route.fulfill({status:503,contentType:'application/json',body:'{"error":"Illustrative unavailable state"}'}):route.fallback());
  await page.goto(f.origin+'/uat/login');await page.getByRole('button',{name:'Continue with Google'}).click();await expect(page.locator('h1')).toHaveText('Workspace unavailable');await expect(page.locator('.stats')).toHaveCount(0);
  fail=false;await page.getByRole('button',{name:'Retry workspace',exact:true}).press('Enter');
  await verifiedJourney(['action:workspace:retry','button:Retry workspace'],async()=>{await expect(page.locator('#identity')).toContainText('carrier');await expect(page.getByRole('status')).toContainText('Workspace updated.');});
  await expect(page.locator('#main')).toHaveAttribute('aria-busy','false');await axeAccessibility(page,'recovered-workspace');
 }finally{await f.close();}
});
test('failed refresh labels stale records and retry restores verified state',async({browser})=>{
 const f=await integratedWorkspace(browser,{role:'carrier',width:768}),{page}=f;
 try{
  await page.goto(f.origin+'/uat/login');await page.getByRole('button',{name:'Continue with Google'}).click();await page.locator('#nav [data-tab=first-load]').click();
  await page.route('**/api/ops/state',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"Illustrative unavailable state"}'}));await page.getByRole('button',{name:'Check progress',exact:true}).click();
  await expect(page.getByRole('region',{name:'Stale workspace'})).toContainText('last confirmed records');await expect(page.locator('.first-load-guide')).toContainText('Progress needs verification');
  await page.unroute('**/api/ops/state');await page.getByRole('button',{name:'Retry workspace',exact:true}).click();await expect(page.getByRole('region',{name:'Stale workspace'})).toHaveCount(0);await expect(page.getByRole('status')).toContainText('Workspace updated.');
 }finally{await f.close();}
});
for(const width of [390,768,1440])test('platform governance summaries preserve operational denial at '+width,async({browser})=>{
 const f=await integratedWorkspace(browser,{role:'platform',width,platformPermissions:['platform:audit','platform:cases','platform:configure','platform:support']}),{page}=f;
 try{
  await page.goto(f.origin+'/uat/login');await page.getByRole('button',{name:'Continue with Google'}).click();await expect(page.getByRole('region',{name:'Governance totals'})).toBeVisible();
  await page.getByRole('link',{name:'Configuration',exact:true}).press('Enter');await expect(page.locator('#platform-config-area')).toBeInViewport();
  expect(await page.evaluate(async()=>(await fetch('/api/ops/state')).status)).toBe(403);await axeAccessibility(page,'governance-'+width);
  await page.screenshot({path:test.info().outputPath('platform-'+width+'.png'),fullPage:true});expect(f.errors).toEqual([]);
 }finally{await f.close();}
});
test('unapproved operational bookmark cannot create a platform view or grant a driver billing authority',async({browser})=>{
 const f=await integratedWorkspace(browser,{role:'driver',width:390}),{page}=f;
 try{
  await page.goto(f.origin+'/uat/login');await page.getByRole('button',{name:'Continue with Google'}).click();await expect(page.locator('#identity')).toContainText('driver');await page.evaluate(()=>{location.hash='billing';});await expect(page.locator('#nav [aria-current=page]')).toHaveText('Overview');await expect(page.locator('#payment-record')).toHaveCount(0);
  expect(await page.evaluate(async()=>(await fetch('/uat/control')).status)).toBe(403);
 }finally{await f.close();}
});
