import {test,expect,signIn,basicAccessibility,noConsoleErrors} from './workspace.mjs';
import {password} from '../helpers/operations-fixture.mjs';
import {runFeatureTick} from '../../domain/operations-features.mjs';

for(const persona of [
 {key:'manager',label:'carrier',width:1440,height:1000},
 {key:'dispatcher',label:'dispatcher',width:1440,height:1000},
 {key:'driver',label:'driver',width:390,height:844},
 {key:'fleetUser',label:'fleet',width:390,height:844},
]){
 test(persona.label+' has an accessible role-scoped workspace at '+persona.width+'px',async({page,workspace},testInfo)=>{
  await page.setViewportSize({width:persona.width,height:persona.height});
  workspace.createLoad();
  await noConsoleErrors(page,async()=>{
   await signIn(page,workspace,workspace[persona.key]);
   await basicAccessibility(page);
   await page.reload();
   await expect(page.locator('#identity')).toContainText(workspace[persona.key].name);
   await page.keyboard.press('Tab');
   await expect(page.getByRole('link',{name:'Skip to workspace'})).toBeFocused();
   await page.keyboard.press('Enter');
   await expect(page.getByRole('main')).toBeFocused();
   // Focus visibility of keyboard-operable controls, plus skip-link target navigation.
   await page.getByRole('button',{name:'Sign out',exact:true}).focus();
   const buttonFocus=await page.getByRole('button',{name:'Sign out',exact:true}).evaluate(el=>getComputedStyle(el).outlineStyle);
   expect(buttonFocus).not.toBe('none');
   await page.getByRole('button',{name:persona.label==='driver'?'My assignments':'Loads',exact:true}).click();
   await basicAccessibility(page);
   await page.getByRole('button',{name:'Overview',exact:true}).click();
   const screenshot=testInfo.outputPath(persona.label+'-'+persona.width+'.png');
   await page.screenshot({path:screenshot,fullPage:true});
   await testInfo.attach(persona.label+'-'+persona.width,{path:screenshot,contentType:'image/png'});
   if(['driver','fleet'].includes(persona.label)){
    await expect(page.getByRole('button',{name:'Invoice readiness',exact:true})).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Review & recovery',exact:true})).toHaveCount(0);
   }
  });
 });
}

test('browser journey creates, dispatches, executes and approves an invoice with real persistence',async({browser,workspace})=>{
 // Full multi-view/persona journey includes repeated axe scans; assertion deadlines remain unchanged.
 test.setTimeout(180000);
 const customer=workspace.command(workspace.manager,'customer:create',null,{name:'Illustrative journey customer'});
 const customerReader=workspace.command(workspace.manager,'user:create',null,{username:'journey-customer@illustrative.invalid',name:'Illustrative Journey Reader',role:'customer',customerId:customer.id,password});
 const pages={},contexts=[];
 for(const [name,actor] of Object.entries({carrier:workspace.manager,dispatcher:workspace.dispatcher,driver:workspace.driver,customer:customerReader})){
  const context=await browser.newContext({viewport:{width:name==='driver'?390:1440,height:1000}});
  contexts.push(context);pages[name]=await context.newPage();await signIn(pages[name],workspace,actor);
 }
 try{
  const {carrier,dispatcher,driver}=pages;
  const errors=[];for(const page of Object.values(pages))page.on('pageerror',error=>errors.push(error.message));
  await carrier.getByRole('button',{name:'Loads',exact:true}).click();
  await carrier.getByRole('button',{name:'Create load',exact:true}).click();
  await carrier.getByLabel('Load reference',{exact:true}).fill('ILL-BROWSER-JOURNEY');
  await carrier.getByLabel('Customer / broker',{exact:true}).fill('Illustrative browser customer');
  await carrier.getByLabel('Customer portal access',{exact:true}).selectOption(customer.id);
  await carrier.getByLabel('Responsible dispatcher',{exact:true}).selectOption(workspace.dispatcher.id);
  await carrier.getByLabel('Commodity',{exact:true}).fill('Illustrative packaged goods');
  await carrier.getByLabel('Weight (lb)',{exact:true}).fill('1000');
  await carrier.getByLabel('Base charge (cents, USD)',{exact:true}).fill('250000');
  await carrier.getByLabel('Pickup location',{exact:true}).fill('Illustrative Chicago origin');
  await carrier.getByLabel('Delivery location',{exact:true}).fill('Illustrative Madison destination');
  await basicAccessibility(carrier);
  await carrier.getByRole('button',{name:'Create draft load',exact:true}).click();
  await expect(carrier.getByRole('heading',{name:'ILL-BROWSER-JOURNEY',exact:true})).toBeVisible();
  await carrier.getByLabel('Document text',{exact:true}).fill(JSON.stringify({loadReference:'ILL-BROWSER-JOURNEY',shipper:'Illustrative shipper',consignee:'Illustrative consignee',commodity:'Illustrative packaged goods',weightLb:1000,pickupLocation:'Illustrative Chicago origin',deliveryLocation:'Illustrative Madison destination'}));
  await carrier.getByRole('button',{name:'Ingest document',exact:true}).click();
  await expect(carrier.locator('#view')).toContainText('pending review');
  carrier.once('dialog',dialog=>dialog.accept('Illustrative shipping fields verified'));
  await carrier.getByRole('button',{name:'Validate document',exact:true}).click();
  await expect(carrier.locator('#view')).toContainText('validated');
  await dispatcher.reload();
  await dispatcher.getByRole('button',{name:'Loads',exact:true}).click();
  await dispatcher.getByRole('button',{name:'Open',exact:true}).click();
  await dispatcher.getByRole('button',{name:'Validate load',exact:true}).click();
  await dispatcher.getByLabel('Driver',{exact:true}).selectOption(workspace.driver.id);
  await dispatcher.getByLabel('Vehicle',{exact:true}).selectOption(workspace.vehicle.id);
  await dispatcher.getByLabel('Assignment reason',{exact:true}).fill('Illustrative eligible browser dispatch');
  await dispatcher.getByRole('button',{name:'Save assignment',exact:true}).click();
  await expect(dispatcher.locator('#view')).toContainText('Load detail · assigned');
  await driver.reload();
  await driver.getByRole('button',{name:'My assignments',exact:true}).click();
  await driver.getByRole('button',{name:'Open',exact:true}).click();
  await expect(driver.locator('#view')).not.toContainText('Illustrative browser customer');
  await expect(driver.locator('#view')).not.toContainText('Base charge');
  await driver.getByRole('button',{name:'Accept assignment',exact:true}).click();
  await driver.getByRole('button',{name:'Complete pickup',exact:true}).click();
  await driver.getByRole('button',{name:'Start transit',exact:true}).click();
  // Command completion replaces the form; wait before typing into the new form.
  await expect(driver.getByRole('button',{name:'Start transit',exact:true})).toHaveCount(0);
  await driver.getByLabel('Current location',{exact:true}).fill('Illustrative driver-reported waypoint');
  await driver.getByLabel('Milestone note',{exact:true}).fill('Illustrative recorded progress, no live GPS');
  await driver.getByRole('button',{name:'Record update',exact:true}).click();
  await expect(driver.locator('#view')).toContainText('Illustrative driver-reported waypoint');
  await driver.getByLabel('What needs attention?',{exact:true}).fill('Illustrative weather needs human review');
  await driver.locator('#exception').getByLabel('Type',{exact:true}).selectOption('weather');
  await driver.getByRole('button',{name:'Report exception',exact:true}).click();
  await expect(driver.locator('#view')).toContainText('Illustrative weather needs human review');
  await dispatcher.reload();
  await dispatcher.getByRole('button',{name:'Review & recovery',exact:true}).click();
  await dispatcher.getByRole('button',{name:'Advance workflow',exact:true}).click();
  await expect(dispatcher.locator('#view')).toContainText('waiting approval');
  await expect(dispatcher.locator('#view')).toContainText('They are not model-generated.');
  await carrier.reload();
  await carrier.getByRole('button',{name:'Review & recovery',exact:true}).click();
  carrier.once('dialog',dialog=>dialog.accept('Weather cleared; reviewed safe resumption'));
  await carrier.getByRole('button',{name:'Approve recommendation',exact:true}).click();
  await expect(carrier.locator('#view')).toContainText('approved');
  await dispatcher.reload();
  await dispatcher.getByRole('button',{name:'Review & recovery',exact:true}).click();
  await dispatcher.getByRole('button',{name:'Advance workflow',exact:true}).click();
  await expect(dispatcher.locator('#view')).toContainText('completed');
  await driver.reload();
  await driver.getByRole('button',{name:'My assignments',exact:true}).click();
  await driver.getByRole('button',{name:'Open',exact:true}).click();
  await driver.getByLabel('Acknowledgment evidence reference',{exact:true}).fill('Illustrative browser acknowledgment reference');
  await driver.getByLabel('Recipient has acknowledged receipt').check();
  await driver.getByRole('button',{name:'Record acknowledgment',exact:true}).click();
  await expect(driver.getByRole('heading',{name:'Delivery acknowledgments',exact:true})).toBeVisible();
  await driver.getByLabel('Delivery proof reference',{exact:true}).fill('Illustrative browser proof reference');
  await driver.getByRole('button',{name:'Confirm delivery',exact:true}).click();
  await expect(driver.locator('#view')).toContainText('Load detail · delivered');
  await basicAccessibility(driver);
  await carrier.reload();
  await carrier.getByRole('button',{name:'Invoice readiness',exact:true}).click();
  await carrier.getByRole('button',{name:'Prepare invoice',exact:true}).click();
  carrier.once('dialog',dialog=>dialog.accept('Illustrative reviewed commercial terms'));
  await carrier.getByRole('button',{name:'Approve record',exact:true}).click();
  await expect(carrier.locator('#view')).toContainText('approved');
  const load=workspace.store.list('load',workspace.manager.tenantId).find(load=>load.reference==='ILL-BROWSER-JOURNEY');
  expect(load.status).toBe('delivered');
  expect(workspace.store.list('invoice',workspace.manager.tenantId).find(invoice=>invoice.loadId===load.id).status).toBe('approved');
  await carrier.getByRole('button',{name:'Billing & receivables',exact:true}).click();
  const answers=['Document-backed invoice approved for local issue','2099-12-01'];
  const answer=dialog=>dialog.accept(answers.shift());carrier.on('dialog',answer);
  await carrier.getByRole('button',{name:'Issue invoice',exact:true}).click();
  await expect(carrier.locator('#view')).toContainText('issued');
  carrier.off('dialog',answer);
  const invoice=workspace.store.list('invoice',workspace.manager.tenantId).find(i=>i.loadId===load.id);
  expect(invoice.status).toBe('issued');
  await runFeatureTick(workspace.ops);
  await pages.customer.reload();
  await pages.customer.getByRole('button',{name:'Invoices',exact:true}).click();
  await expect(pages.customer.locator('#view')).toContainText('issued');
  await expect(pages.customer.locator('#view')).toContainText('ILL-BROWSER-JOURNEY');
  await pages.customer.getByRole('button',{name:'Notifications',exact:true}).click();
  await expect(pages.customer.locator('#view')).toContainText('invoice issued');
  await expect(pages.customer.locator('#view')).toContainText('local recorded');
  await expect(pages.customer.locator('#view')).toContainText('no external messages are sent');
  await carrier.getByLabel('Outstanding invoice',{exact:true}).selectOption(invoice.id);
  await carrier.getByLabel('Reported amount (cents, USD)',{exact:true}).fill(String(invoice.totalCents));
  await carrier.getByLabel('Payment evidence reference',{exact:true}).fill('ILL-BROWSER-REPORTED-PAYMENT');
  await carrier.getByLabel('Invoice reference to match',{exact:true}).fill(invoice.invoiceReference);
  await carrier.getByLabel('Evidence source',{exact:true}).selectOption('local_fixture');
  await basicAccessibility(carrier);
  await carrier.getByRole('button',{name:'Record evidence',exact:true}).click();
  await expect(carrier.locator('#view')).toContainText('reported');
  carrier.once('dialog',dialog=>dialog.accept('Human matched explicitly illustrative local evidence'));
  await carrier.getByRole('button',{name:'Reconcile evidence',exact:true}).click();
  await expect(carrier.locator('#view')).toContainText('reconciled');
  expect(workspace.store.get('invoice',invoice.id,workspace.manager.tenantId).status).toBe('paid');
  await pages.customer.reload();
  await pages.customer.getByRole('button',{name:'Invoices',exact:true}).click();
  await expect(pages.customer.locator('#view')).toContainText('paid');
  await carrier.getByRole('button',{name:'Cost intelligence',exact:true}).click();
  await carrier.getByLabel('Delivered shipment',{exact:true}).selectOption(load.id);
  await carrier.getByLabel('Reported distance (miles)',{exact:true}).fill('165.5');
  await carrier.getByLabel('Distance evidence identifier',{exact:true}).fill('ILL-BROWSER-DISTANCE');
  await carrier.getByRole('button',{name:'Record distance evidence',exact:true}).click();
  await expect(carrier.getByRole('status')).toContainText('Saved.');
  expect(workspace.store.list('measurement',workspace.manager.tenantId)[0].source).toBe('user_reported');
  await carrier.getByRole('button',{name:'Operations analytics',exact:true}).click();
  await expect(carrier.getByRole('heading',{name:'Operations analytics',exact:true})).toBeVisible();
  await expect(carrier.locator('#view')).toContainText('165.5 reported miles');
  await expect(carrier.locator('#view')).toContainText('ROI and savings are unavailable');
  await expect(carrier.locator('#view')).toContainText('Based on 1 records.');
  await basicAccessibility(carrier);
  expect(errors).toEqual([]);
 }finally{for(const context of contexts)await context.close();}
});

test('browser rejects unauthorized sessions and preserves tenant isolation',async({page,workspace})=>{
 await page.goto(workspace.baseURL+'/app');
 await expect(page).toHaveURL(workspace.baseURL+'/login');
 await page.getByLabel('Username',{exact:true}).fill(workspace.manager.username);
 await page.getByLabel('Password',{exact:true}).fill('incorrect illustrative password');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Sign-in failed.');
 const own=workspace.createLoad();
 await signIn(page,workspace,workspace.outsider);
 await expect(page.locator('#view')).not.toContainText(own.reference);
 await page.getByRole('button',{name:'Loads',exact:true}).click();
 await expect(page.locator('#view')).not.toContainText(own.reference);
 await page.getByRole('button',{name:'Sign out',exact:true}).click();
 await expect(page).toHaveURL(workspace.baseURL+'/login');
 const result=await page.request.get(workspace.baseURL+'/api/ops/state');
 expect(result.status()).toBe(401);
});

test('customer portal exposes only its latest reviewed BOL and protects revision history',async({browser,workspace},testInfo)=>{
 const customer=workspace.command(workspace.manager,'customer:create',null,{name:'Illustrative Portal Customer'});
 const reader=workspace.command(workspace.manager,'user:create',null,{username:'portal-browser@illustrative.invalid',name:'Illustrative Customer Reader',role:'customer',customerId:customer.id,password});
 const hiddenLoad=workspace.createLoad();
 const load=workspace.command(workspace.manager,'load:create',null,{reference:'ILL-PORTAL-DOCUMENT',customer:customer.name,customerId:customer.id,dispatcherId:workspace.dispatcher.id,commodity:'Illustrative packaged goods',weightLb:1000,rateCents:20000,charges:[],factored:false,stops:[{type:'pickup',location:'Illustrative Chicago origin',at:'2026-11-02T14:00:00Z'},{type:'delivery',location:'Illustrative Madison destination',at:'2026-11-03T16:00:00Z'}]});
 const ship={loadReference:load.reference,shipper:'Illustrative shipper',consignee:'Illustrative consignee',commodity:load.commodity,weightLb:load.weightLb,pickupLocation:load.stops[0].location,deliveryLocation:load.stops[1].location};
 const carrierContext=await browser.newContext({viewport:{width:1440,height:1000}}),customerContext=await browser.newContext({viewport:{width:390,height:844}});
 try{
  const carrier=await carrierContext.newPage(),portal=await customerContext.newPage(),errors=[];
  for(const page of [carrier,portal])page.on('pageerror',e=>errors.push(e.message));
  await signIn(carrier,workspace,workspace.manager);
  await carrier.getByRole('button',{name:'Loads',exact:true}).click();
  await carrier.getByRole('row').filter({hasText:load.reference}).getByRole('button',{name:'Open',exact:true}).click();
  await carrier.getByLabel('Document text',{exact:true}).fill(JSON.stringify({...ship,loadReference:'ILL-WRONG-SHIPMENT'}));
  await carrier.getByRole('button',{name:'Ingest document',exact:true}).click();
  await expect(carrier.locator('#view')).toContainText('low confidence');
  carrier.once('dialog',d=>d.accept('Attempted review detects wrong reference'));
  await carrier.getByRole('button',{name:'Validate document',exact:true}).click();
  await expect(carrier.getByRole('alert')).toContainText('Correct required or mismatched shipping fields');
  await carrier.getByLabel('Revise existing document',{exact:true}).selectOption({label:'BOL revision 1'});
  await carrier.getByLabel('Document text',{exact:true}).fill(JSON.stringify(ship));
  await carrier.getByRole('button',{name:'Ingest document',exact:true}).click();
  await expect(carrier.getByRole('link',{name:'Read document revision 2',exact:true})).toBeVisible();
  carrier.once('dialog',d=>d.accept('Latest shipping fields verified against shipment'));
  await carrier.getByRole('button',{name:'Validate document',exact:true}).last().click();
  await expect(carrier.locator('#view')).toContainText('validated');
  const docs=workspace.store.list('document',workspace.manager.tenantId).filter(d=>d.loadId===load.id);
  expect(docs).toHaveLength(2);
  const first=docs.find(d=>d.revision===1),latest=docs.find(d=>d.revision===2);
  await signIn(portal,workspace,reader);
  await expect(portal.locator('#view')).toContainText(load.reference);
  await expect(portal.locator('#view')).not.toContainText(hiddenLoad.reference);
  await portal.getByRole('button',{name:'Loads',exact:true}).click();
  await portal.getByRole('button',{name:'Open',exact:true}).click();
  await expect(portal.getByRole('link',{name:'Read document revision 1',exact:true})).toHaveCount(0);
  await expect(portal.getByRole('link',{name:'Read document revision 2',exact:true})).toBeVisible();
  await expect(portal.getByRole('button',{name:'Validate document',exact:true})).toHaveCount(0);
  await expect(portal.getByRole('heading',{name:'Add shipping document',exact:true})).toHaveCount(0);
  await basicAccessibility(portal);
  const image=testInfo.outputPath('customer-documents-390.png');
  await portal.screenshot({path:image,fullPage:true});
  await testInfo.attach('customer-documents-390',{path:image,contentType:'image/png'});
  const popupPromise=portal.waitForEvent('popup');
  await portal.getByRole('link',{name:'Read document revision 2',exact:true}).click();
  const popup=await popupPromise;
  await expect(popup).toHaveURL(workspace.baseURL+'/api/ops/documents/'+latest.id);
  await expect(popup.locator('body')).toContainText(load.reference);
  expect((await portal.request.get(workspace.baseURL+'/api/ops/documents/'+first.id)).status()).toBe(403);
  const unauthorized=workspace.command(workspace.manager,'document:ingest',hiddenLoad,{type:'other',mimeType:'text/plain',content:'Illustrative unrelated customer document'});
  expect((await portal.request.get(workspace.baseURL+'/api/ops/documents/'+unauthorized.id)).status()).toBe(403);
  expect(errors).toEqual([]);
 }finally{await carrierContext.close();await customerContext.close();}
});

test('Wave 4 browser joins advisory analysis, human assignment approval and bounded runtime recovery',async({browser,workspace},testInfo)=>{
 let load=workspace.createLoad();load=workspace.command(workspace.dispatcher,'load:validate',load);
 const contexts=[],pages={},errors=[];
 for(const [name,actor] of Object.entries({carrier:workspace.manager,dispatcher:workspace.dispatcher,driver:workspace.driver})){
  const context=await browser.newContext({viewport:{width:name==='driver'?390:1440,height:1000}});contexts.push(context);
  pages[name]=await context.newPage();pages[name].on('pageerror',error=>errors.push(error.message));
  await signIn(pages[name],workspace,actor);
 }
 try{
  const {carrier,dispatcher,driver}=pages;
  await dispatcher.getByRole('button',{name:'Loads',exact:true}).click();
  await dispatcher.getByRole('button',{name:'Open',exact:true}).click();
  await dispatcher.getByLabel('Estimated route miles',{exact:true}).fill('150');
  await dispatcher.getByLabel('Assumed average speed (mph)',{exact:true}).fill('50');
  await dispatcher.getByLabel('Expected handling (minutes)',{exact:true}).fill('30');
  await dispatcher.getByLabel('Estimate source',{exact:true}).selectOption('local_fixture');
  await dispatcher.getByRole('button',{name:'Evaluate arrival estimate',exact:true}).click();
  await expect(dispatcher.getByRole('status')).toContainText('Saved.');
  await dispatcher.getByRole('button',{name:'Analyze risk',exact:true}).click();
  await dispatcher.getByRole('button',{name:'Recommend capacity',exact:true}).click();
  expect(workspace.store.get('load',load.id,workspace.manager.tenantId).status).toBe('validated');
  await carrier.reload();
  await carrier.getByRole('button',{name:'Control tower',exact:true}).click();
  await expect(carrier.locator('#view')).toContainText('Rules-based analysis only');
  await expect(carrier.getByRole('heading',{name:'Arrival estimates',exact:true})).toBeVisible();
  await expect(carrier.getByRole('heading',{name:'Shipment risk evidence',exact:true})).toBeVisible();
  const originalRisk=carrier.locator('section').filter({has:carrier.getByRole('heading',{name:'Shipment risk evidence',exact:true})});
  await expect(originalRisk).toContainText('Shipment version '+load.version);
  await expect(originalRisk).not.toContainText('Shipment changed since this evidence was recorded');
  carrier.once('dialog',dialog=>dialog.accept('Carrier reviewed eligibility and proposed assignment'));
  await carrier.getByRole('button',{name:'Approve capacity proposal',exact:true}).click();
  expect(workspace.store.get('load',load.id,workspace.manager.tenantId).status).toBe('validated');
  await dispatcher.reload();
  await dispatcher.getByRole('button',{name:'Control tower',exact:true}).click();
  dispatcher.once('dialog',dialog=>dialog.accept('Dispatcher applies carrier-approved assignment'));
  await dispatcher.getByRole('button',{name:'Apply approved assignment',exact:true}).click();
  await expect(dispatcher.locator('#view')).toContainText('applied');
  for(const heading of ['Shipment risk evidence','Arrival estimates']){
   const previousEvidence=dispatcher.locator('section').filter({has:dispatcher.getByRole('heading',{name:heading,exact:true})});
   await expect(previousEvidence).toContainText('Shipment version '+load.version);
   await expect(previousEvidence).toContainText('Shipment changed since this evidence was recorded; rerun the analysis or review before relying on it.');
  }
  expect(workspace.store.get('load',load.id,workspace.manager.tenantId).status).toBe('assigned');
  expect(workspace.store.list('assignment',workspace.manager.tenantId).filter(a=>a.status==='active')).toHaveLength(1);
  await driver.reload();
  await expect(driver.getByRole('button',{name:'Control tower',exact:true})).toHaveCount(0);
  await driver.getByRole('button',{name:'My assignments',exact:true}).click();
  await driver.getByRole('button',{name:'Open',exact:true}).click();
  await expect(driver.getByRole('button',{name:'Analyze risk',exact:true})).toHaveCount(0);
  await expect(driver.getByRole('button',{name:'Recommend capacity',exact:true})).toHaveCount(0);

  await carrier.reload();
  await carrier.getByRole('button',{name:'Loads',exact:true}).click();
  await carrier.getByRole('button',{name:'Open',exact:true}).click();
  await carrier.getByRole('button',{name:'Start coordinated review',exact:true}).click();
  for(let i=0;i<5;i++)await runFeatureTick(workspace.ops);
  await carrier.reload();
  await carrier.getByRole('button',{name:'Workflow runtime',exact:true}).click();
  await expect(carrier.locator('#view')).toContainText('completed');
  await expect(carrier.locator('#view')).toContainText('Checkpoint 5');
  await expect(carrier.getByRole('heading',{name:'Workflow health',exact:true})).toBeVisible();
  await expect(carrier.locator('#view')).toContainText('No current workflow alerts');
  expect(workspace.store.list('agentdecision',workspace.manager.tenantId)).toHaveLength(5);
  await basicAccessibility(carrier);

  await carrier.getByRole('button',{name:'Governance',exact:true}).click();
  await carrier.getByLabel('Runtime policy',{exact:true}).selectOption('no');
  await carrier.getByLabel('Policy change reason',{exact:true}).fill('Illustrative human pause for review');
  await carrier.getByRole('button',{name:'Save advisory policy',exact:true}).click();
  await expect(carrier.getByRole('status')).toContainText('Saved.');
  await carrier.getByRole('button',{name:'Loads',exact:true}).click();
  await carrier.getByRole('button',{name:'Open',exact:true}).click();
  await carrier.getByRole('button',{name:'Start coordinated review',exact:true}).click();
  await expect(carrier.getByRole('alert')).toContainText('Automation is disabled');
  await carrier.getByRole('button',{name:'Governance',exact:true}).click();
  await carrier.getByLabel('Runtime policy',{exact:true}).selectOption('yes');
  await carrier.getByLabel('Policy change reason',{exact:true}).fill('Illustrative human authorizes advisory resumption');
  await carrier.getByRole('button',{name:'Save advisory policy',exact:true}).click();
  await expect(carrier.getByRole('status')).toContainText('Saved.');

  await carrier.getByRole('button',{name:'Local adapters',exact:true}).click();
  await carrier.getByLabel('Shipment',{exact:true}).selectOption(load.id);
  await carrier.getByLabel('Capability',{exact:true}).selectOption('mapping');
  await carrier.getByLabel('Local evidence (JSON)',{exact:true}).fill(JSON.stringify({source:'user_estimate',distanceMiles:150,averageMph:50,handlingMinutes:30,departureAt:new Date().toISOString()}));
  await carrier.getByRole('button',{name:'Queue local adapter',exact:true}).click();
  await expect(carrier.getByRole('status')).toContainText('Saved.');
  await runFeatureTick(workspace.ops);
  await carrier.reload();
  await carrier.getByRole('button',{name:'Local adapters',exact:true}).click();
  await expect(carrier.locator('#view')).toContainText('completed');
  const result=workspace.store.list('connectorresult',workspace.manager.tenantId)[0];
  expect(result.provenance.live).toBe(false);
  expect(result.provenance.model).toBe(null);
  await basicAccessibility(carrier);

  await carrier.getByRole('button',{name:'Cost intelligence',exact:true}).click();
  await carrier.getByLabel('Shipment',{exact:true}).selectOption(load.id);
  await carrier.getByLabel('Category',{exact:true}).selectOption('fuel');
  await carrier.getByLabel('Cost (cents, USD)',{exact:true}).fill('10000');
  await carrier.getByLabel('Basis',{exact:true}).selectOption('recorded');
  await carrier.getByLabel('Cost evidence reference',{exact:true}).fill('ILL-COST-RECORDED');
  await carrier.getByRole('button',{name:'Record cost',exact:true}).click();
  await expect(carrier.getByRole('status')).toContainText('Saved.');
  await carrier.getByLabel('Cost (cents, USD)',{exact:true}).fill('2500');
  await carrier.getByLabel('Basis',{exact:true}).selectOption('estimate');
  await carrier.getByLabel('Cost evidence reference',{exact:true}).fill('ILL-COST-ESTIMATE');
  await carrier.getByRole('button',{name:'Record cost',exact:true}).click();
  await expect(carrier.getByRole('status')).toContainText('Saved.');
  await expect(carrier.locator('#view')).toContainText('Savings are unmeasured.');
  await expect(carrier.locator('#cost-summary')).toContainText('10000');
  await expect(carrier.locator('#cost-summary')).toContainText('2500');
  await expect(carrier.locator('#cost-summary')).toContainText('Unmeasured');
  await basicAccessibility(carrier);
  await carrier.getByRole('button',{name:'Control tower',exact:true}).click();
  const image=testInfo.outputPath('control-tower-1440.png');
  await carrier.screenshot({path:image,fullPage:true});
  await testInfo.attach('control-tower-1440',{path:image,contentType:'image/png'});
  expect(errors).toEqual([]);
 }finally{for(const context of contexts)await context.close();}
});

 test('dispatcher can mark ready and cancel an assignment without duplicate active claims',async({page,workspace})=>{
  let load=workspace.command(workspace.dispatcher,'load:validate',workspace.createLoad());
  await signIn(page,workspace,workspace.dispatcher);await page.getByRole('button',{name:'Loads',exact:true}).click();await page.getByRole('button',{name:'Open',exact:true}).click();
  await page.getByRole('button',{name:'Mark ready',exact:true}).click();await expect(page.locator('h1')).toHaveText(load.reference);
  await expect(page.getByRole('button',{name:'Mark ready',exact:true})).toHaveCount(0);
  load=workspace.store.get('load',load.id,workspace.manager.tenantId);expect(load.lifecycleState).toBe('ready');
  workspace.command(workspace.dispatcher,'load:assign',load,{driverId:workspace.driver.id,vehicleId:workspace.vehicle.id,reason:'Synthetic assignment'});
  await page.reload();await page.getByRole('button',{name:'Loads',exact:true}).click();await page.getByRole('button',{name:'Open',exact:true}).click();page.once('dialog',dialog=>dialog.accept('Human cancels synthetic assignment'));
  await page.getByRole('button',{name:'Cancel assignment',exact:true}).click();await expect(page.getByRole('button',{name:'Cancel assignment',exact:true})).toHaveCount(0);
  expect(workspace.store.list('assignment',workspace.manager.tenantId).filter(a=>a.status==='active')).toHaveLength(0);await basicAccessibility(page);
 });
