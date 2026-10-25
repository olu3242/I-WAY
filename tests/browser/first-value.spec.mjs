import {test,expect,signIn,basicAccessibility} from './workspace.mjs';
import {integratedWorkspace} from './integrated-workspace.mjs';
import {verifiedOutcome,verifiedJourney} from './control-evidence.mjs';
import {syntheticPassword} from '../helpers/uat-fixture.mjs';

async function follow(page,id){
 await page.getByRole('button',{name:'First load guide',exact:true}).click();
 await verifiedOutcome('navigation:first-load',async()=>{
  await expect(page.locator('h1')).toHaveText('First load guide');
  await expect(page.getByRole('button',{name:'First load guide',exact:true})).toHaveAttribute('aria-current','page');
 });
 await page.getByLabel('Visible load',{exact:true}).selectOption(id);
 const reference=await page.getByLabel('Visible load',{exact:true}).evaluate(el=>el.selectedOptions[0].textContent.split(' · ')[0]);
 await page.getByRole('button',{name:'Follow this load',exact:true}).click();
 await verifiedJourney(['form:journey-select','button:Follow this load'],async()=>{
  await expect(page.locator('.first-load-guide strong')).toHaveText(reference);
  await expect(page.getByRole('status')).toContainText('Following the selected load');
 });
}
const outcome=page=>page.getByRole('heading',{name:'Load assigned. Driver accepted.',exact:true});

for(const width of [390,1440])test(`guided creation to driver acceptance at ${width}`,async({browser,workspace},info)=>{
 test.setTimeout(120000);
 const carrierContext=await browser.newContext({viewport:{width,height:900}}),driverContext=await browser.newContext({viewport:{width:390,height:844}});
 const carrier=await carrierContext.newPage(),driver=await driverContext.newPage(),errors=[];
 for(const page of [carrier,driver])page.on('pageerror',e=>errors.push(e.message));
 try{
  await signIn(carrier,workspace,workspace.manager);
  await carrier.getByRole('button',{name:'Start guided dispatch',exact:true}).press('Enter');
  await verifiedOutcome('action:journey-start',async()=>{
   await expect(carrier.locator('h1')).toHaveText('First load guide');
   await expect(carrier.locator('h1')).toBeFocused();
   await expect(carrier.locator('.journey-steps')).toBeVisible();
  });
  await basicAccessibility(carrier);
  await carrier.getByRole('button',{name:'Create guided load',exact:true}).click();
  await verifiedOutcome('action:journey-create',async()=>{
   await expect(carrier.locator('h1')).toHaveText('Create a load');
   await expect(carrier.locator('#create-load')).toBeVisible();
  });
  await carrier.getByLabel('Load reference',{exact:true}).fill('ILL-FIRST-VALUE');
  await carrier.getByLabel('Customer / broker',{exact:true}).fill('Illustrative customer');
  await carrier.getByLabel('Responsible dispatcher',{exact:true}).selectOption(workspace.dispatcher.id);
  await carrier.getByLabel('Commodity',{exact:true}).fill('Illustrative packaged goods');
  await carrier.getByLabel('Pickup location',{exact:true}).fill('Illustrative San Antonio pickup');
  await carrier.getByLabel('Delivery location',{exact:true}).fill('Illustrative Austin delivery');
  await carrier.getByRole('button',{name:'Create draft load',exact:true}).click();
  await expect(carrier.locator('h1')).toHaveText('ILL-FIRST-VALUE');
  await expect(outcome(carrier)).toHaveCount(0);
  await carrier.getByRole('button',{name:'Validate load',exact:true}).click();
  await carrier.getByLabel('Driver',{exact:true}).selectOption(workspace.driver.id);
  await carrier.getByLabel('Vehicle',{exact:true}).selectOption(workspace.vehicle.id);
  await carrier.getByLabel('Assignment reason',{exact:true}).fill('Illustrative approved dispatch');
  await carrier.getByRole('button',{name:'Save assignment',exact:true}).click();
  await expect(carrier.locator('.first-load-guide')).toContainText('Ask the assigned driver');
  await expect(outcome(carrier)).toHaveCount(0);
  const load=workspace.store.list('load',workspace.manager.tenantId).find(l=>l.reference==='ILL-FIRST-VALUE');
  await signIn(driver,workspace,workspace.driver);
  await follow(driver,load.id);
  await driver.getByRole('button',{name:'Open guided load',exact:true}).click();
  await verifiedOutcome('action:journey-open',async()=>{
   await expect(driver.locator('h1')).toHaveText(load.reference);
   await expect(driver.getByRole('button',{name:'Accept assignment',exact:true})).toBeVisible();
  });
  await expect(driver.locator('#view')).not.toContainText('Illustrative customer');
  await driver.getByRole('button',{name:'Accept assignment',exact:true}).click();
  await expect(outcome(driver)).toBeVisible();
  await carrier.getByRole('button',{name:'Check progress',exact:true}).click();
  await verifiedOutcome('action:journey-refresh',async()=>{
   await expect(outcome(carrier)).toBeVisible();
   expect(workspace.store.get('load',load.id,workspace.manager.tenantId).status).toBe('accepted');
  });
  await basicAccessibility(carrier);await basicAccessibility(driver);
  await carrier.screenshot({path:info.outputPath('accepted-'+width+'.png'),fullPage:true});
  // Acceptance is revoked by a real domain action, never retained as a completed badge.
  let current=workspace.store.get('load',load.id,workspace.manager.tenantId);
  workspace.command(workspace.manager,'load:unassign',current,{reason:'Illustrative reassignment review'});
  await carrier.getByRole('button',{name:'Check progress',exact:true}).click();
  await expect(outcome(carrier)).toHaveCount(0);
  await expect(carrier.locator('.journey-steps li').last()).toContainText('Pending');
  await driver.getByRole('button',{name:'Check progress',exact:true}).click();
  await expect(outcome(driver)).toHaveCount(0);
  await driver.getByRole('button',{name:'First load guide',exact:true}).click();
  await expect(driver.locator('.first-load-guide')).not.toContainText('ILL-FIRST-VALUE');
  expect(errors).toEqual([]);
 }finally{await carrierContext.close();await driverContext.close();}
});

test('guide scopes loads, rejects empty selection, and reports refresh failure',async({page,workspace})=>{
 const load=workspace.createLoad();
 await signIn(page,workspace,workspace.outsider);
 await page.getByRole('button',{name:'Start guided dispatch',exact:true}).click();
 await expect(page.getByLabel('Visible load')).not.toContainText(load.reference);
 await page.getByRole('button',{name:'Follow this load',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Choose a visible load');
 await page.route('**/api/ops/state',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Operation unavailable.'})}));
 await page.getByRole('button',{name:'Check progress',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Operation unavailable');
 await expect(outcome(page)).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Check progress',exact:true})).toBeEnabled();
});

test('invitation setup through first driver acceptance preserves MFA',async({browser},info)=>{
 test.setTimeout(120000);
 const f=await integratedWorkspace(browser,{role:'carrier',width:1440});
 try{
  f.command(f.manager,'load:unassign',f.assignment,{reason:'Release synthetic fixture capacity for the new guided load'});
  const started=Date.now();
  const entry=f.roster.find(e=>e.role==='carrier');
  await f.uat.workflow.issue({adminSession:'synthetic-approved-admin',userId:entry.userId});
  await f.page.goto(f.origin+'/uat/setup#'+f.uat.mail[0].token);
  await f.page.getByLabel('New password').fill(syntheticPassword);
  await f.page.getByRole('button',{name:'Set password',exact:true}).click();
  await expect(f.page.getByRole('status')).toContainText('Password set');
  await f.page.getByRole('link',{name:'Return to sign in'}).click();
  await f.page.getByLabel('Email',{exact:true}).fill(entry.email);
  await f.page.getByLabel('Password',{exact:true}).fill(syntheticPassword);
  await f.page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(f.page.getByLabel('Authenticator code')).toBeVisible();
  await expect(f.page.getByRole('button',{name:'Start guided dispatch',exact:true})).toHaveCount(0);
  await f.page.getByLabel('Authenticator code').fill('123456');
  await f.page.getByRole('button',{name:'Verify',exact:true}).click();
  await expect(f.page).toHaveURL(f.origin+'/app');
  await f.page.getByRole('button',{name:'Start guided dispatch',exact:true}).click();
  await expect(f.page.locator('h1')).toHaveText('First load guide');
  await expect(f.page.locator('.journey-steps li').first()).toContainText('Complete');
  await expect(outcome(f.page)).toHaveCount(0);
  await basicAccessibility(f.page);
  await f.page.getByRole('button',{name:'Create guided load',exact:true}).click();
  await f.page.getByLabel('Load reference',{exact:true}).fill('ILL-ONBOARD-TO-VALUE');
  await f.page.getByLabel('Customer / broker',{exact:true}).fill('Illustrative pilot customer');
  await f.page.getByLabel('Responsible dispatcher',{exact:true}).selectOption(f.dispatcher.id);
  await f.page.getByLabel('Commodity',{exact:true}).fill('Illustrative goods');
  await f.page.getByLabel('Pickup location',{exact:true}).fill('Illustrative San Antonio');
  await f.page.getByLabel('Delivery location',{exact:true}).fill('Illustrative Austin');
  await f.page.getByRole('button',{name:'Create draft load',exact:true}).click();
  await f.page.getByRole('button',{name:'Validate load',exact:true}).click();
  await f.page.getByLabel('Driver',{exact:true}).selectOption(f.driver.id);
  await f.page.getByLabel('Vehicle',{exact:true}).selectOption(f.vehicle.id);
  await f.page.getByLabel('Assignment reason',{exact:true}).fill('Illustrative reviewed dispatch');
  await f.page.getByRole('button',{name:'Save assignment',exact:true}).click();
  await expect(f.page.locator('.first-load-guide')).toContainText('Ask the assigned driver');
  const load=f.store.list('load',f.manager.tenantId).find(l=>l.reference==='ILL-ONBOARD-TO-VALUE');
  await f.page.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(f.page).toHaveURL(f.origin+'/uat/login');
  const driver=f.roster.find(e=>e.role==='driver');
  await f.uat.workflow.issue({adminSession:'synthetic-approved-admin',userId:driver.userId});
  await f.page.goto(f.origin+'/uat/setup#'+f.uat.mail.at(-1).token);
  await f.page.getByLabel('New password').fill(syntheticPassword);
  await f.page.getByRole('button',{name:'Set password',exact:true}).click();
  await expect(f.page.getByRole('status')).toContainText('Password set');
  await f.page.getByRole('link',{name:'Return to sign in'}).click();
  await f.page.getByLabel('Email',{exact:true}).fill(driver.email);
  await f.page.getByLabel('Password',{exact:true}).fill(syntheticPassword);
  await f.page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(f.page).toHaveURL(f.origin+'/app');
  await follow(f.page,load.id);
  await f.page.getByRole('button',{name:'Open guided load',exact:true}).click();
  await f.page.getByRole('button',{name:'Accept assignment',exact:true}).click();
  await expect(outcome(f.page)).toBeVisible();
  expect(f.store.get('load',load.id,f.manager.tenantId).status).toBe('accepted');
  await info.attach('first-value-timing',{body:JSON.stringify({scope:'automated local synthetic fixture',elapsedMs:Date.now()-started,startsAt:'invitation preparation',endsAt:'server-confirmed driver acceptance',excludes:['fleet provisioning','real invitation delivery','human typing and decision time'],customerSpeedClaim:false}),contentType:'application/json'});
  expect(f.errors).toEqual([]);
 }finally{await f.close();}
});

test('unconfirmed acceptance does not complete the first-value guide',async({page,workspace})=>{
 const load=workspace.assign();
 await signIn(page,workspace,workspace.driver);
 await follow(page,load.id);
 await page.getByRole('button',{name:'Open guided load',exact:true}).click();
 await page.route('**/api/ops/offline',route=>route.abort('failed'));
 await page.getByRole('button',{name:'Accept assignment',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('This action was not confirmed');
 await expect(page.getByRole('button',{name:'Cancel queued action',exact:true})).toBeVisible();
 await expect(outcome(page)).toHaveCount(0);
 await expect(page.locator('.journey-steps li').last()).toContainText('Pending');
 expect(workspace.store.get('load',load.id,workspace.manager.tenantId).status).toBe('assigned');
});
