import {test,expect,basicAccessibility} from './workspace.mjs';
import {integratedWorkspace} from './integrated-workspace.mjs';
import {durablePostgresFixture} from '../helpers/durable-uat-fixture.mjs';
const durable=process.env.IWAY_BROWSER_DURABLE_OPT_IN==='true';
let postgres;
test.beforeAll(async()=>{if(durable)postgres=await durablePostgresFixture();});
test.afterAll(async()=>{if(postgres)await postgres.close();});

async function signIn(f,role){
 f.setLoginRole(role);
 await f.page.goto(f.origin+'/uat/login');
 await f.page.getByRole('button',{name:'Continue with Google',exact:true}).click();
 await expect(f.page).toHaveURL(f.origin+'/app');
 await expect(f.page.locator('#identity')).toContainText(role);
}
async function follow(f,id){
 await f.page.getByRole('button',{name:'First load guide',exact:true}).click();
 await f.page.getByLabel('Visible load',{exact:true}).selectOption(id);
 await f.page.getByRole('button',{name:'Follow this load',exact:true}).click();
 await expect(f.page.getByRole('status')).toContainText('Following the selected load');
}
async function readLoads(f){
 return f.page.evaluate(async()=>{
  const response=await fetch('/api/ops/state');
  if(!response.ok)throw Error('Application state unavailable');
  return (await response.json()).loads;
 });
}
for(const width of [390,1440])test(`guided first value through ${durable?'PostgreSQL restart':'synthetic integrated sessions'} at ${width}`,async({browser},info)=>{
 test.setTimeout(180000);
 const f=await integratedWorkspace(browser,{role:'carrier',width,postgres}),reference='ILL-PERSISTED-FIRST-'+width;
 const {page}=f;
 try{
  await signIn(f,'carrier');
  // Release only the preassigned disposable fixture load through the real UI.
  await page.getByRole('button',{name:'Loads',exact:true}).click();
  await page.getByRole('row').filter({hasText:f.assignment.reference}).getByRole('button',{name:'Open',exact:true}).click();
  page.once('dialog',dialog=>dialog.accept('Release illustrative fixture capacity'));
  await page.getByRole('button',{name:'Cancel assignment',exact:true}).click();
  await expect(page.getByRole('button',{name:'Cancel assignment',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'First load guide',exact:true}).click();
  await page.getByRole('button',{name:'Create guided load',exact:true}).click();
  await page.getByLabel('Load reference',{exact:true}).fill(reference);
  await page.getByLabel('Customer / broker',{exact:true}).fill('Illustrative persistence customer');
  await page.getByLabel('Responsible dispatcher',{exact:true}).selectOption(f.dispatcher.id);
  await page.getByLabel('Commodity',{exact:true}).fill('Illustrative goods');
  await page.getByLabel('Pickup location',{exact:true}).fill('Illustrative San Antonio');
  await page.getByLabel('Delivery location',{exact:true}).fill('Illustrative Austin');
  await page.getByRole('button',{name:'Create draft load',exact:true}).click();
  await expect(page.locator('h1')).toHaveText(reference);
  await page.getByRole('button',{name:'Validate load',exact:true}).click();
  await page.getByLabel('Driver',{exact:true}).selectOption(f.driver.id);
  await page.getByLabel('Vehicle',{exact:true}).selectOption(f.vehicle.id);
  await page.getByLabel('Assignment reason',{exact:true}).fill('Illustrative reviewed assignment');
  await page.getByRole('button',{name:'Save assignment',exact:true}).click();
  await expect(page.locator('.first-load-guide')).toContainText('Ask the assigned driver');
  const load=(await readLoads(f)).find(l=>l.reference===reference);
  expect(load.status).toBe('assigned');
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page).toHaveURL(f.origin+'/uat/login');
  await signIn(f,'driver');
  await follow(f,load.id);
  await page.getByRole('button',{name:'Open guided load',exact:true}).click();
  await page.getByRole('button',{name:'Accept assignment',exact:true}).click();
  const accepted=page.getByRole('heading',{name:'Load assigned. Driver accepted.',exact:true});
  await expect(accepted).toBeVisible();
  const before=(await readLoads(f)).find(l=>l.id===load.id);
  expect(before.status).toBe('accepted');
  if(postgres){await postgres.restartDatabase();await f.restart();}
  await page.reload();
  await expect(page.locator('#identity')).toContainText('driver');
  await follow(f,load.id);
  await expect(accepted).toBeVisible();
  const after=(await readLoads(f)).find(l=>l.id===load.id);
  expect(after.status).toBe('accepted');
  expect(after.version).toBe(before.version);
  expect(after.driverId).toBe(f.driver.id);
  await basicAccessibility(page);
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page).toHaveURL(f.origin+'/uat/login');
  await signIn(f,'carrier');
  await follow(f,load.id);
  await expect(accepted).toBeVisible();
  expect((await readLoads(f)).find(l=>l.id===load.id).status).toBe('accepted');
  await info.attach('first-value-persistence',{body:JSON.stringify({backend:postgres?'disposable PostgreSQL':'disposable SQLite',databaseRestartExecuted:Boolean(postgres),loadVersionBefore:before.version,loadVersionAfter:after.version,driverAcceptanceConfirmed:true,carrierAcceptanceConfirmed:true,liveProvider:false}),contentType:'application/json'});
  expect(f.errors).toEqual([]);
 }finally{await f.close();}
});
