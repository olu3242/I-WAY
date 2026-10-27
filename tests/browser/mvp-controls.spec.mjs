import {test,expect,signIn,axeAccessibility} from './workspace.mjs';
import {verifiedOutcome} from './control-evidence.mjs';
import {addUser} from '../../server/operations-auth.mjs';
import {password} from '../helpers/operations-fixture.mjs';

for(const width of [390,1440])test('administration edits, configuration versions, type switch, cancellation and deactivation at '+width,async({page,workspace})=>{
 test.setTimeout(120000);await page.setViewportSize({width,height:900});await signIn(page,workspace,workspace.manager);await page.goto(workspace.baseURL+'/admin');await expect(page.locator('#notice')).toHaveText('Ready');
 await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Skip to administration'})).toBeFocused();await page.keyboard.press('Enter');await expect(page.locator('#main')).toBeFocused();
 await page.getByLabel('Legal name',{exact:true}).fill('Illustrative saved company');await page.getByRole('button',{name:'Save company settings',exact:true}).click();
 await verifiedOutcome('form:settings',async()=>{await expect(page.locator('#notice')).toHaveText('Company settings saved');await page.reload();await expect(page.getByLabel('Legal name',{exact:true})).toHaveValue('Illustrative saved company');});
 const types={
  'permission-set':{name:'illustrative',grants:['load:view'],denials:[]},
  'field-security':{name:'illustrative',object:'load',field:'customer',read:['carrier']},
  'validation-rule':{name:'illustrative',object:'load',field:'customer',operator:'required',enabled:true},
  'related-tab':{name:'illustrative',object:'load',relatedObject:'document',label:'Documents',order:1},
  'page-layout':{name:'illustrative',object:'load',fields:['reference'],tabs:[]},
  'business-unit':{name:'illustrative',code:'QA',active:true},
  location:{name:'illustrative',address:'Illustrative local office',timeZone:'America/Chicago',active:true},
 };
 for(const [kind,data] of Object.entries(types)){
  await page.getByLabel('Configuration type').selectOption(kind);await expect(page.locator('#data')).toHaveValue('');await expect(page.getByRole('button',{name:'Deactivate configuration'})).toBeDisabled();
  await page.getByLabel('Record identifier').fill('illustrative');await page.getByLabel('Configuration JSON').fill(JSON.stringify(data));await page.getByRole('button',{name:'Save configuration',exact:true}).click();
  await expect(page.locator('#notice')).toHaveText('Configuration saved');await expect(page.getByLabel('Expected version')).toHaveValue('1');
  await page.getByLabel('Configuration JSON').fill(JSON.stringify({...data,name:'updated'}));await page.getByRole('button',{name:'Save configuration',exact:true}).click();
  await verifiedOutcome('form:editor:'+kind,async()=>{await expect(page.locator('#notice')).toHaveText('Configuration saved');await expect(page.getByLabel('Expected version')).toHaveValue('2');});
  await verifiedOutcome('form:editor',async()=>{await expect(page.getByLabel('Expected version')).toHaveValue('2');});
  await page.getByRole('button',{name:'updated (v2)',exact:true}).click();await verifiedOutcome('button:configuration-record',async()=>{await expect(page.getByLabel('Record identifier')).toBeFocused();await expect(page.getByLabel('Expected version')).toHaveValue('2');});
  page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Deactivate configuration',exact:true}).click();await expect(page.getByRole('button',{name:'updated (v2)',exact:true})).toBeVisible();
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Deactivate configuration',exact:true}).click();
  await verifiedOutcome('button:Deactivate configuration',async()=>{await expect(page.locator('#notice')).toHaveText('Configuration deactivated');await expect(page.getByRole('button',{name:'updated (v2)',exact:true})).toHaveCount(0);});
  const retained=workspace.store.db.prepare('SELECT data,version FROM organization_admin WHERE tenant_id=? AND kind=? AND id=?').get(workspace.manager.tenantId,kind,'illustrative');expect(JSON.parse(retained.data)._deactivated).toBe(true);expect(retained.version).toBe(3);
 }
 await axeAccessibility(page,'administration-edited');await page.getByRole('link',{name:'Operations',exact:true}).click();await verifiedOutcome('link:/app',async()=>{await expect(page).toHaveURL(workspace.baseURL+'/app');});
});

test('administration failed APIs preserve input, announce errors and recover',async({page,workspace})=>{
 await signIn(page,workspace,workspace.manager);await page.goto(workspace.baseURL+'/admin');await expect(page.locator('#notice')).toHaveText('Ready');
 await page.getByLabel('Record identifier').fill('illustrative');await page.getByLabel('Configuration JSON').fill('{"name":"illustrative","grants":[],"denials":[]}');
 await page.route('**/api/ops/admin/items',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"Illustrative service unavailable"}'}));
 await page.getByRole('button',{name:'Save configuration',exact:true}).click();await expect(page.getByRole('alert')).toHaveText('Illustrative service unavailable');await expect(page.getByRole('alert')).toBeFocused();await expect(page.getByLabel('Record identifier')).toHaveValue('illustrative');
 await axeAccessibility(page,'administration-api-error');await page.unroute('**/api/ops/admin/items');await page.getByRole('button',{name:'Save configuration',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Configuration saved');
 await page.getByLabel('Expected version').fill('0');await page.getByRole('button',{name:'Save configuration',exact:true}).click();await expect(page.getByRole('alert')).toHaveText('CONFLICT');
});

for(const persona of ['manager','fleetUser','driver'])test(persona+' navigation, notification preferences, missing routes and cross-tenant denial',async({page,workspace})=>{
 test.setTimeout(180000);workspace.assign();await signIn(page,workspace,workspace[persona]);
 const tabs=await page.locator('#nav button').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.tab,label:n.textContent})));
 for(const tab of tabs){await page.locator('#nav [data-tab="'+tab.id+'"]').press('Enter');await verifiedOutcome('navigation:'+tab.id,async()=>{await expect(page.locator('h1')).toBeFocused();await expect(page.locator('#nav [data-tab="'+tab.id+'"]')).toHaveAttribute('aria-current','page');});await axeAccessibility(page,persona+'-'+tab.id);}
 if(await page.locator('#nav [data-tab="notifications"]').count()){
  await page.locator('#nav [data-tab="notifications"]').click();await page.getByLabel('Shipment notifications').selectOption('no');await page.getByRole('button',{name:'Save preferences'}).click();
  await verifiedOutcome('form:notification-preference',async()=>{await expect(page.getByRole('status')).toContainText('Saved.');await page.reload();await page.locator('#nav [data-tab="notifications"]').click();await expect(page.getByLabel('Shipment notifications')).toHaveValue('no');});
 }
 const otherDispatcher=addUser(workspace.store,{tenantId:workspace.outsider.tenantId,username:'other-dispatcher@illustrative.invalid',name:'Illustrative other dispatcher',role:'dispatcher',password});
 const other=workspace.command(workspace.outsider,'load:create',null,{reference:'ILL-OTHER',customer:'Illustrative other tenant',commodity:'Illustrative cargo',dispatcherId:otherDispatcher.id,weightLb:1000,rateCents:0,charges:[],factored:false,stops:[{type:'pickup',location:'Illustrative origin',at:'2026-11-02T14:00:00Z'},{type:'delivery',location:'Illustrative destination',at:'2026-11-03T14:00:00Z'}]});
 const csrf=(await(await page.request.get(workspace.baseURL+'/api/ops/state')).json()).csrf;
 const denied=await page.request.post(workspace.baseURL+'/api/ops/commands',{headers:{origin:workspace.baseURL,'x-csrf-token':csrf},data:{action:'load:void',resourceId:other.id,expectedVersion:other.version,payload:{reason:'Illustrative forbidden attempt'},idempotencyKey:crypto.randomUUID()}});expect([403,404]).toContain(denied.status());expect(workspace.store.get('load',other.id,workspace.outsider.tenantId).status).toBe('draft');
 expect((await page.request.get(workspace.baseURL+'/api/ops/not-implemented')).status()).toBe(404);
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await verifiedOutcome('button:Sign out',async()=>{await expect(page).toHaveURL(workspace.baseURL+'/login');expect((await page.request.get(workspace.baseURL+'/api/ops/state')).status()).toBe(401);});
});
