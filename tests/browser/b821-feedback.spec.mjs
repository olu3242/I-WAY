import {test,expect,axeAccessibility} from './workspace.mjs';
import {integratedWorkspace} from './integrated-workspace.mjs';
import {durablePostgresFixture} from '../helpers/durable-uat-fixture.mjs';
import {verifiedJourney} from './control-evidence.mjs';
const durable=process.env.IWAY_BROWSER_DURABLE_OPT_IN==='true';let postgres;
test.beforeAll(async()=>{if(durable)postgres=await durablePostgresFixture();});
test.afterAll(async()=>{if(postgres)await postgres.close();});
async function login(f){await f.page.goto(f.origin+'/uat/login');await f.page.getByRole('button',{name:'Continue with Google'}).click();await expect(f.page.locator('#uat-feedback')).toBeVisible();await expect(f.page.locator('#uat-feedback')).toHaveAttribute('aria-busy','false');}
async function api(page,input){return page.evaluate(async input=>{const csrf=(await(await fetch('/api/ops/session')).json()).csrf;const response=await fetch('/api/ops/feedback',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify(input)});return {status:response.status,body:await response.json()};},input);}
async function rows(page){return (await api(page,{action:'list'})).body.rows;}
for(const [role,width] of [['platform',1440],['carrier',768],['fleet',390],['driver',390]])test(role+' feedback persists across reconstruction, login and scoped reads',async({browser})=>{
 const f=await integratedWorkspace(browser,{role,width,postgres,feedbackPermissions:true,platformPermissions:['platform:audit','platform:cases']}),{page}=f;
 try{
  await login(f);await page.getByLabel('Affected workflow').selectOption(role==='platform'?'administration':'loads');await page.getByLabel('Observed symptom').selectOption('recovery');await page.getByLabel('Impact',{exact:true}).selectOption('major');await page.getByLabel('Reproducibility',{exact:true}).selectOption('intermittent');
  await page.getByRole('button',{name:'Submit UAT feedback'}).click();await expect(page.locator('#uat-feedback [role=status]')).toHaveText('Feedback saved.');
  const [row]=await rows(page);expect(row).toMatchObject({status:'reported',persona:role,symptom:'recovery'});
  await f.restart();await page.reload();await expect(page.locator('#uat-feedback')).toHaveAttribute('aria-busy','false');expect((await rows(page))[0]).toEqual(row);
  const invalid=await api(page,{action:'create',idempotencyKey:crypto.randomUUID(),payload:{workflow:'loads',symptom:'recovery',severity:'major',reproducibility:'once',diagnostics:'Disallowed raw evidence'}});expect(invalid.status).toBe(422);
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page).toHaveURL(f.origin+'/uat/login');await login(f);
  await verifiedJourney(['form:uat-feedback-create','button:Submit UAT feedback','button:Refresh UAT feedback'],async()=>{await page.getByRole('button',{name:'Refresh UAT feedback'}).click();await expect(page.locator('#uat-feedback')).toHaveAttribute('aria-busy','false');expect(await rows(page)).toEqual([row]);});
  await page.locator('#uat-feedback summary').click();await expect(page.locator('#uat-feedback ol')).toContainText('reported');await axeAccessibility(page,'uat-feedback-'+role);await page.screenshot({path:test.info().outputPath('feedback-'+role+'.png'),fullPage:true});expect(f.errors).toEqual([]);
 }finally{await f.close();}
});
test('driver feedback receives fleet-owned triage and reporter-only failed/passing retest',async({browser})=>{
 const f=await integratedWorkspace(browser,{role:'driver',width:390,postgres,feedbackPermissions:true}),{page}=f;
 const switchRole=async role=>{await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page).toHaveURL(f.origin+'/uat/login');f.setLoginRole(role);await login(f);};
 try{
  await login(f);await page.getByRole('button',{name:'Submit UAT feedback'}).click();await expect(page.locator('#uat-feedback [role=status]')).toHaveText('Feedback saved.');
  await switchRole('fleet');
  for(const status of ['triaged','in_progress','awaiting_retest']){
   await page.getByLabel('Next feedback status').selectOption(status);await page.getByLabel('Feedback owner').selectOption(f.fleetUser.id);
   if(status==='awaiting_retest')await page.getByLabel('Reviewed commit SHA or run reference').fill('run-reviewed_0123');
   await page.getByRole('button',{name:'Save feedback triage'}).click();await expect(page.locator('#uat-feedback [role=status]')).toHaveText('Feedback saved.');expect((await rows(page))[0].status).toBe(status);
  }
  const row=(await rows(page))[0],foreign=await api(page,{action:'retest',id:row.id,expectedVersion:row.version,idempotencyKey:crypto.randomUUID(),payload:{passed:true,evidenceReference:'run-foreign_0123'}});expect(foreign.status).toBe(403);
  await f.restart();await switchRole('driver');await page.getByLabel('Retest outcome').selectOption('no');await page.getByLabel('Retest run reference').fill('run-retest_failed');await page.getByRole('button',{name:'Record feedback retest'}).click();await expect(page.locator('#uat-feedback [role=status]')).toHaveText('Feedback saved.');expect((await rows(page))[0].status).toBe('in_progress');
  await switchRole('fleet');await page.getByLabel('Reviewed commit SHA or run reference').fill('run-reviewed_again');await page.getByRole('button',{name:'Save feedback triage'}).click();await expect(page.locator('#uat-feedback [role=status]')).toHaveText('Feedback saved.');
  await switchRole('driver');await page.getByLabel('Retest outcome').selectOption('yes');await page.getByLabel('Retest run reference').fill('run-retest_passed');
  await verifiedJourney(['button:Save feedback triage','button:Record feedback retest'],async()=>{await page.getByRole('button',{name:'Record feedback retest'}).click();await expect(page.locator('#uat-feedback [role=status]')).toHaveText('Feedback saved.');expect((await rows(page))[0].status).toBe('closed');});
  await expect(page.getByRole('button',{name:'Record feedback retest'})).toHaveCount(0);await axeAccessibility(page,'closed-reporter-feedback');expect(f.errors).toEqual([]);
 }finally{await f.close();}
});
test('lost feedback response retains structured values and safe retry creates one report',async({browser})=>{
 let lost=false;const f=await integratedWorkspace(browser,{role:'driver',width:390,postgres,feedbackPermissions:true,responseInterceptor:async request=>{if(!lost&&request.url().endsWith('/api/ops/feedback')&&request.postDataJSON()?.action==='create'){lost=true;return 'abort';}}}),{page}=f;
 try{
  await login(f);await page.getByLabel('Impact',{exact:true}).selectOption('minor');await page.getByRole('button',{name:'Submit UAT feedback'}).click();await expect(page.locator('#feedback-notice')).toHaveAttribute('role','alert');await expect(page.getByRole('button',{name:'Submit UAT feedback'})).toBeEnabled();await expect(page.getByLabel('Impact',{exact:true})).toHaveValue('minor');
  expect(await rows(page)).toHaveLength(1);await f.restart();await page.getByRole('button',{name:'Submit UAT feedback'}).click();await expect(page.locator('#uat-feedback [role=status]')).toHaveText('Feedback saved.');expect(await rows(page)).toHaveLength(1);expect(f.errors).toEqual([]);
 }finally{await f.close();}
});
