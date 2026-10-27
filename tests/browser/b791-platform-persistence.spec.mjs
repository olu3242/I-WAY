import {test,expect,axeAccessibility} from './workspace.mjs';
import {integratedWorkspace as workspace} from './integrated-workspace.mjs';
import {durablePostgresFixture} from '../helpers/durable-uat-fixture.mjs';
import {verifiedJourney} from './control-evidence.mjs';
const durable=process.env.IWAY_BROWSER_DURABLE_OPT_IN==='true';let postgres;
test.beforeAll(async()=>{if(durable)postgres=await durablePostgresFixture();});
test.afterAll(async()=>{if(postgres)await postgres.close();});
async function open(browser,{responseInterceptor}={}){
 const f=await workspace(browser,{role:'platform',width:390,postgres,responseInterceptor,platformPermissions:['platform:audit','platform:cases','platform:configure','platform:support']});
 await login(f);return f;
}
async function login(f){await f.page.goto(f.origin+'/uat/login');await f.page.getByRole('button',{name:'Continue with Google'}).click();await expect(f.page.locator('#platform-workspace')).toHaveAttribute('aria-busy','false');await expect(f.page.getByLabel('Target response hours')).toBeEnabled();}
async function configuration(page){return page.evaluate(async()=>{
 const csrf=(await(await fetch('/api/ops/session')).json()).csrf;
 const r=await fetch('/api/ops/platform/workspace',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify({action:'list'})});if(!r.ok)throw Error('CONFIGURATION_READ_DENIED');
 return (await r.json()).configuration.filter(row=>row.key==='supportCaseDueHours');
});}
async function save(page,value){
 await page.getByLabel('Target response hours').fill(String(value));await page.getByLabel('Configuration reason').fill('Illustrative reviewed response target');
 const response=page.waitForResponse(r=>r.url().endsWith('/api/ops/platform/workspace')&&r.request().postDataJSON()?.action==='config');
 await page.getByRole('button',{name:'Save support setting'}).click();const r=await response;expect(r.status()).toBe(200);expect((await r.json()).value).toBe(value);
 await expect(page.locator('#platform-workspace')).toHaveAttribute('aria-busy','false');await expect(page.locator('#activity')).toContainText('Platform record saved.');
}

test('support response 48 survives confirmed API read, reload, application reconstruction and fresh login',async({browser})=>{
 const f=await open(browser),{page}=f;
 try{
  await save(page,48);const [saved]=await configuration(page);expect(saved.value).toBe(48);
  await f.restart();await page.reload();await expect(page.locator('#platform-workspace')).toHaveAttribute('aria-busy','false');await expect(page.getByLabel('Target response hours')).toHaveValue('48');
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page).toHaveURL(f.origin+'/uat/login');await login(f);
  await verifiedJourney(['form:platform-config','button:Save support setting'],async()=>{await expect(page.getByLabel('Target response hours')).toHaveValue('48');expect((await configuration(page))[0]).toMatchObject({id:saved.id,value:48,version:saved.version});});
  await axeAccessibility(page,'configuration-fresh-session');await page.screenshot({path:test.info().outputPath('confirmed-48-fresh-session.png'),fullPage:true});expect(f.errors).toEqual([]);
 }finally{await f.close();}
});

test('pending platform write fences adjacent forms and replaces stale success before a new save',async({browser})=>{
 let release,started;const held=new Promise(r=>release=r),committed=new Promise(r=>started=r);
 const f=await open(browser,{responseInterceptor:async request=>{if(request.postDataJSON()?.action==='casecreate'){started();await held;}}}),{page}=f;
 try{
  await save(page,24);
  await page.getByLabel('Case title').fill('Illustrative pending response');await page.getByLabel('Approved tenant reference').fill('ILL namespace');await page.getByRole('button',{name:'Create support case'}).click();await committed;
  await expect(page.locator('#platform-workspace')).toHaveAttribute('aria-busy','true');await expect(page.getByLabel('Target response hours')).toBeDisabled();await expect(page.getByRole('button',{name:'Save support setting'})).toBeDisabled();await expect(page.locator('#activity')).toHaveText('Saving platform record…');
  await page.screenshot({path:test.info().outputPath('pending-platform-write.png'),fullPage:true});release();
  await expect(page.locator('#platform-workspace')).toHaveAttribute('aria-busy','false');await expect(page.locator('#activity')).toHaveText('Platform record saved.');await save(page,48);expect((await configuration(page))[0].value).toBe(48);expect(f.errors).toEqual([]);
 }finally{release();await f.close();}
});

test('lost configuration response retains input and exact retry cannot duplicate the persisted setting',async({browser})=>{
 let lost=false;const f=await open(browser,{responseInterceptor:async request=>{if(!lost&&request.postDataJSON()?.action==='config'){lost=true;return 'abort';}}}),{page}=f;
 try{
  await page.getByLabel('Target response hours').fill('48');await page.getByLabel('Configuration reason').fill('Illustrative lost receipt');await page.getByRole('button',{name:'Save support setting'}).click();
  await expect(page.locator('#activity')).toHaveAttribute('role','alert');await expect(page.getByLabel('Target response hours')).toHaveValue('48');await expect(page.getByRole('button',{name:'Save support setting'})).toBeEnabled();
  const before=await configuration(page);expect(before).toHaveLength(1);expect(before[0].value).toBe(48);await f.restart();
  await page.getByRole('button',{name:'Save support setting'}).click();await expect(page.locator('#activity')).toHaveText('Platform record saved.');await expect(page.locator('#platform-workspace')).toHaveAttribute('aria-busy','false');
  expect(await configuration(page)).toEqual(before);expect(f.errors).toEqual([]);
 }finally{await f.close();}
});

test('stale configuration rejects safely and retains the correction until a fresh revision is reviewed',async({browser})=>{
 const f=await open(browser),{page}=f;
 try{
  await save(page,48);const [old]=await configuration(page);
  expect(await page.evaluate(async row=>{const csrf=(await(await fetch('/api/ops/session')).json()).csrf;return(await fetch('/api/ops/platform/workspace',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify({action:'config',id:row.id,expectedVersion:row.version,payload:{key:'supportCaseDueHours',value:60,reason:'Illustrative concurrent authorized update'},idempotencyKey:crypto.randomUUID()})})).status;},old)).toBe(200);
  await page.getByLabel('Target response hours').fill('72');await page.getByLabel('Configuration reason').fill('Illustrative browser correction');await page.getByRole('button',{name:'Save support setting'}).click();
  await expect(page.locator('#activity')).toHaveAttribute('role','alert');await expect(page.locator('#activity')).toContainText('Refresh configuration.');await expect(page.getByLabel('Target response hours')).toHaveValue('72');expect((await configuration(page))[0].value).toBe(60);
  await page.reload();await expect(page.locator('#platform-workspace')).toHaveAttribute('aria-busy','false');await expect(page.getByLabel('Target response hours')).toHaveValue('60');await save(page,72);expect((await configuration(page))[0].value).toBe(72);expect(f.errors).toEqual([]);
 }finally{await f.close();}
});
