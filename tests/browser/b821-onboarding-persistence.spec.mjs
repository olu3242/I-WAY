import {test,expect,axeAccessibility} from './workspace.mjs';
import {integratedWorkspace} from './integrated-workspace.mjs';
import {durablePostgresFixture} from '../helpers/durable-uat-fixture.mjs';
const durable=process.env.IWAY_BROWSER_DURABLE_OPT_IN==='true';let postgres;
test.beforeAll(async()=>{if(durable)postgres=await durablePostgresFixture();});
test.afterAll(async()=>{if(postgres)await postgres.close();});
test('onboarding activation replaces stale success until its confirmed receipt and persists after reconstruction',async({browser})=>{
 let release,started;const held=new Promise(r=>release=r),committed=new Promise(r=>started=r);
 const f=await integratedWorkspace(browser,{role:'carrier',width:390,postgres,responseInterceptor:async request=>{if(request.url().endsWith('/api/ops/commands')&&request.postDataJSON()?.action==='onboarding:activate'){started();await held;}}}),{page}=f;
 try{
  await page.goto(f.origin+'/uat/login');await page.getByRole('button',{name:'Continue with Google'}).click();await expect(page.locator('#identity')).toContainText('carrier');
  await page.evaluate(async()=>{const s=await(await fetch('/api/ops/state')).json(),load=s.loads.find(row=>row.status==='assigned');if(!load)throw Error('FIXTURE_ASSIGNMENT_MISSING');const r=await fetch('/api/ops/commands',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':s.csrf},body:JSON.stringify({action:'load:void',resourceId:load.id,expectedVersion:load.version,idempotencyKey:crypto.randomUUID(),payload:{reason:'Illustrative fixture releases assignment before onboarding hold'}})});if(!r.ok)throw Error('FIXTURE_ASSIGNMENT_RELEASE_DENIED');});
  await page.reload();await expect(page.locator('#identity')).toContainText('carrier');await page.getByRole('button',{name:'Onboarding',exact:true}).click();
  await page.getByLabel('Resource',{exact:true}).selectOption('driver:'+f.driver.id);await page.getByLabel('Reason for onboarding hold').fill('Illustrative reviewed onboarding');await page.getByRole('button',{name:'Start onboarding',exact:true}).click();await expect(page.locator('#message')).toHaveText('Onboarding saved.');
  await page.getByLabel(/^Display name/).fill('Illustrative confirmed profile');await page.getByLabel(/^Agreement reference/).fill('ILL approved agreement');await page.getByRole('button',{name:'Save onboarding profile'}).click();await expect(page.locator('#message')).toHaveText('Onboarding saved.');
  await page.getByRole('button',{name:'Submit onboarding',exact:true}).click();await expect(page.locator('#message')).toHaveText('Onboarding decision saved.');
  const answers=['Illustrative reviewed decision','ILL approved verification'],dialogs=dialog=>dialog.accept(answers.shift());page.on('dialog',dialogs);const approval=page.waitForResponse(r=>r.url().endsWith('/api/ops/commands')&&r.request().postDataJSON()?.action==='onboarding:review');await page.getByRole('button',{name:'Approve profile',exact:true}).click();expect((await approval).status()).toBe(200);await expect(page.locator('#message')).toHaveText('Onboarding decision saved.');page.off('dialog',dialogs);
  page.once('dialog',dialog=>dialog.accept('Illustrative activation'));const receipt=page.waitForResponse(r=>r.url().endsWith('/api/ops/commands')&&r.request().postDataJSON()?.action==='onboarding:activate');await page.getByRole('button',{name:'Activate onboarding'}).click();await committed;
  await expect(page.locator('#message')).toHaveText('Saving onboarding decision…');await expect(page.getByRole('button',{name:'Activate onboarding'})).toBeDisabled();
  release();const response=await receipt;expect(response.status()).toBe(200);const row=await response.json();expect(row.status).toBe('active');await expect(page.locator('#message')).toHaveText('Onboarding decision saved.');
  await f.restart();await page.reload();await page.getByRole('button',{name:'Onboarding',exact:true}).click();await expect(page.locator('#view')).toContainText('active');
  const saved=await page.evaluate(async id=>{const r=await fetch('/api/ops/state');if(!r.ok)throw Error('STATE_READ_DENIED');return(await r.json()).onboardings.find(row=>row.id===id);},row.id);expect(saved).toMatchObject({id:row.id,status:'active',version:row.version});await axeAccessibility(page,'confirmed-onboarding-activation');expect(f.errors).toEqual([]);
 }finally{release();await f.close();}
});
