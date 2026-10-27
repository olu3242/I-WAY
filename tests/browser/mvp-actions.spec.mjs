import {test,expect,signIn,axeAccessibility} from './workspace.mjs';
import {verifiedOutcome} from './control-evidence.mjs';
import {password} from '../helpers/operations-fixture.mjs';
import {runFeatureTick} from '../../domain/operations-features.mjs';
const reason='Illustrative human review';
async function decision(page,label,key,assertion){page.once('dialog',dialog=>dialog.accept(reason));await page.getByRole('button',{name:label,exact:true}).click();await verifiedOutcome('action:'+key,assertion);}
async function open(page){await page.getByRole('button',{name:'Loads',exact:true}).click();await page.getByRole('button',{name:'Open',exact:true}).first().click();}

test('carrier account, fleet and customer forms persist and account deactivation retains identity',async({page,workspace})=>{
 await signIn(page,workspace,workspace.manager);await page.getByRole('button',{name:'Workspace access',exact:true}).click();
 await page.getByLabel('Fleet company name').fill('Illustrative new fleet');await page.getByRole('button',{name:'Add fleet',exact:true}).click();await verifiedOutcome('form:fleet',async()=>{await expect(page.getByRole('status')).toContainText('Saved.');expect(workspace.store.list('fleet',workspace.manager.tenantId).some(f=>f.name==='Illustrative new fleet')).toBe(true);});
 await page.locator('#user').getByLabel('Display name').fill('Illustrative new dispatcher');await page.locator('#user').getByLabel('Username',{exact:true}).fill('new-dispatcher@illustrative.invalid');await page.locator('#user').getByLabel('Initial local password').fill(password);await page.getByRole('button',{name:'Create account',exact:true}).click();
 await verifiedOutcome('form:user',async()=>{await expect(page.locator('#view')).toContainText('Illustrative new dispatcher');});
 const row=page.getByRole('row').filter({hasText:'Illustrative new dispatcher'});page.once('dialog',dialog=>dialog.accept(reason));await row.getByRole('button',{name:'Deactivate',exact:true}).click();
 await verifiedOutcome('action:user:deactivate',async()=>{await expect(row).toContainText('inactive');const user=workspace.store.db.prepare('SELECT data FROM users WHERE username=?').get('new-dispatcher@illustrative.invalid');expect(JSON.parse(user.data).active).toBe(false);});
 await page.getByRole('button',{name:'Customers',exact:true}).click();await page.getByLabel('Customer organization name').fill('Illustrative new customer');await page.getByRole('button',{name:'Create customer relationship'}).click();await verifiedOutcome('form:customer-create',async()=>{await expect(page.locator('#view')).toContainText('Illustrative new customer');});
});

test('carrier manages driver and equipment, reverses approvals and persists vehicle creation',async({page,workspace})=>{
 await signIn(page,workspace,workspace.manager);await page.getByRole('button',{name:'People & equipment',exact:true}).click();
 const driver=page.locator('.inline-record').filter({hasText:workspace.driver.name});await driver.getByRole('button',{name:'Manage',exact:true}).click();await verifiedOutcome('action:edit-driver',async()=>{await expect(page.locator('h1')).toHaveText(workspace.driver.name);});
 await decision(page,'Revoke approval','driver:approve',async()=>{await expect(page.getByRole('button',{name:'Approve for carrier'})).toBeVisible();});await decision(page,'Approve for carrier','driver:approve',async()=>{await expect(page.getByRole('button',{name:'Revoke approval'})).toBeVisible();});
 await page.getByLabel('Availability',{exact:true}).selectOption('no');await page.getByLabel('Reason for update').fill(reason);await page.getByRole('button',{name:'Save changes',exact:true}).click();await verifiedOutcome('form:asset-edit',async()=>{await expect(page.getByRole('status')).toContainText('Saved.');expect(workspace.store.get('driver',workspace.driver.id,workspace.manager.tenantId).available).toBe(false);});
 await page.getByRole('button',{name:'Back to assets'}).click();await page.locator('.inline-record').filter({hasText:workspace.vehicle.name}).getByRole('button',{name:'Manage',exact:true}).click();await verifiedOutcome('action:edit-vehicle',async()=>{await expect(page.locator('h1')).toHaveText(workspace.vehicle.name);});
 await decision(page,'Revoke approval','vehicle:approve',async()=>{await expect(page.getByRole('button',{name:'Approve for carrier'})).toBeVisible();});await decision(page,'Approve for carrier','vehicle:approve',async()=>{await expect(page.getByRole('button',{name:'Revoke approval'})).toBeVisible();});
 await page.getByRole('button',{name:'Back to assets'}).click();await page.getByLabel('Vehicle name / unit').fill('Illustrative new unit');await page.getByRole('button',{name:'Add vehicle'}).click();await verifiedOutcome('form:vehicle',async()=>{await expect(page.locator('#view')).toContainText('Illustrative new unit');});
});

test('draft navigation, void cancellation, document rejection and missing-document scan have outcomes',async({page,workspace})=>{
 const load=workspace.createLoad();await signIn(page,workspace,workspace.manager);await open(page);
 await page.getByLabel('Document text').fill(JSON.stringify({loadReference:load.reference,shipper:'Illustrative shipper',consignee:'Illustrative consignee',commodity:load.commodity,weightLb:load.weightLb,pickupLocation:load.stops[0].location,deliveryLocation:load.stops[1].location}));await page.getByRole('button',{name:'Ingest document',exact:true}).click();await expect(page.getByRole('button',{name:'Reject document'})).toBeVisible();
 await decision(page,'Reject document','document:reject',async()=>{await expect(page.locator('#view')).toContainText('rejected');});
 await page.getByRole('button',{name:'Check document requirements'}).click();await verifiedOutcome('action:document:scan',async()=>{await expect(page.getByRole('status')).toContainText('Decision saved.');expect(workspace.store.list('documentexception',workspace.manager.tenantId).length).toBeGreaterThan(0);});
 page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Void load'}).click();await expect(page.getByRole('button',{name:'Void load'})).toBeEnabled();expect(workspace.store.get('load',load.id,workspace.manager.tenantId).status).toBe('draft');
 await decision(page,'Void load','load:void',async()=>{await expect(page.locator('#view')).toContainText('Load detail · cancelled');expect(workspace.store.get('load',load.id,workspace.manager.tenantId).status).toBe('void');});
 await page.getByRole('button',{name:'All loads'}).click();await verifiedOutcome('action:back',async()=>{await expect(page.locator('h1')).toHaveText('Loads');});await page.getByRole('button',{name:'Create load',exact:true}).click();await expect(page.locator('#load-wizard')).toBeVisible();await page.getByRole('button',{name:'Back to loads'}).click();await expect(page.locator('h1')).toHaveText('Loads');
});

test('capacity rejection and recovery approval rejection leave shipment authority intact',async({page,workspace})=>{
 let load=workspace.command(workspace.dispatcher,'load:validate',workspace.createLoad());const proposal=workspace.command(workspace.dispatcher,'capacity:recommend',load);
 workspace.command(workspace.dispatcher,'exception:report',load,{type:'weather',reason});const workflow=workspace.store.list('workflow',workspace.manager.tenantId)[0];workspace.command(workspace.dispatcher,'workflow:advance',workflow);
 await signIn(page,workspace,workspace.manager);await page.getByRole('button',{name:'Control tower'}).click();await decision(page,'Reject capacity proposal','capacity:reject',async()=>{await expect(page.locator('#view')).toContainText('rejected');expect(workspace.store.get('capacityproposal',proposal.id,workspace.manager.tenantId).status).toBe('rejected');});
 await page.getByRole('button',{name:'Review & recovery'}).click();await decision(page,'Reject','approval:reject',async()=>{await expect(page.getByRole('button',{name:'Restart review'})).toBeVisible();});await decision(page,'Restart review','workflow:restart',async()=>{await expect(page.getByRole('button',{name:'Advance workflow'})).toBeVisible();});expect(workspace.store.get('load',load.id,workspace.manager.tenantId).status).toBe('validated');
});

test('blocked orchestration and connector reviews can be retried and cancelled with audit evidence',async({page,workspace})=>{
 const load=workspace.createLoad();workspace.command(workspace.manager,'orchestration:request',load);workspace.command(workspace.manager,'connector:request',load,{capability:'mapping',input:{source:'user_estimate',distanceMiles:100,averageMph:50,handlingMinutes:0,departureAt:new Date().toISOString()}});
 workspace.command(workspace.manager,'governance:update',null,{enabled:false,disabledTools:[],reason});await runFeatureTick(workspace.ops);
 workspace.command(workspace.manager,'governance:update',workspace.store.list('governancepolicy',workspace.manager.tenantId)[0],{enabled:true,disabledTools:[],reason});
 await signIn(page,workspace,workspace.manager);
 for(const [tab,kind] of [['Workflow runtime','orchestration'],['Local adapters','connector']]){
  await page.getByRole('button',{name:tab,exact:true}).click();await decision(page,'Retry review',kind+':retry',async()=>{await expect(page.getByRole('button',{name:'Retry review'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Cancel review'})).toBeVisible();});
  await decision(page,'Cancel review',kind+':cancel',async()=>{await expect(page.locator('#view')).toContainText('cancelled');await expect(page.getByRole('button',{name:'Cancel review'})).toHaveCount(0);});
 }await axeAccessibility(page,'runtime-cancelled');
});

test('verified invoice generation, payment rejection, invoice void and delivery close persist',async({page,workspace})=>{
 let load=workspace.assign();load=workspace.command(workspace.driver,'load:accept',load);load=workspace.command(workspace.driver,'load:pickup',load,{stopId:load.stops[0].id});load=workspace.command(workspace.driver,'load:transit',load);
 const document=workspace.command(workspace.manager,'document:ingest',load,{type:'BOL',mimeType:'application/json',content:JSON.stringify({loadReference:load.reference,shipper:'Illustrative shipper',consignee:'Illustrative consignee',commodity:load.commodity,weightLb:load.weightLb,pickupLocation:load.stops[0].location,deliveryLocation:load.stops[1].location})});workspace.command(workspace.manager,'document:review',document,{decision:'validate',reason});
 workspace.command(workspace.driver,'pod:record',load,{stopId:load.stops[1].id,recipientAcknowledged:true,evidenceReference:'Illustrative acknowledgment'});load=workspace.command(workspace.driver,'load:deliver',load,{stopId:load.stops[1].id,proofReference:'Illustrative delivery proof'});
 await signIn(page,workspace,workspace.manager);await page.getByRole('button',{name:'Billing & receivables'}).click();await page.getByRole('button',{name:'Generate verified invoice'}).click();await verifiedOutcome('action:billing:generate',async()=>{await expect(page.getByRole('button',{name:'Approve record'})).toBeVisible();});
 await decision(page,'Approve record','finance:approve',async()=>{await expect(page.getByRole('button',{name:'Issue invoice'})).toBeVisible();});
 const answers=[reason,'2099-12-01'],answer=d=>d.accept(answers.shift());page.on('dialog',answer);await page.getByRole('button',{name:'Issue invoice'}).click();await expect(page.locator('#view')).toContainText('issued');page.off('dialog',answer);
 let invoice=workspace.store.list('invoice',workspace.manager.tenantId)[0];workspace.command(workspace.manager,'payment:record',invoice,{amountCents:100,currency:'USD',reference:'Illustrative disputed evidence',invoiceReference:invoice.invoiceReference,provenance:'local_fixture',receivedAt:'2026-01-01T12:00:00Z'});
 await page.reload();await page.getByRole('button',{name:'Billing & receivables'}).click();await decision(page,'Reject evidence','payment:reject',async()=>{await expect(page.locator('#view')).toContainText('rejected');expect(workspace.store.list('payment',workspace.manager.tenantId)[0].status).toBe('rejected');});
 await decision(page,'Void invoice','billing:void',async()=>{await expect(page.locator('#view')).toContainText('void');expect(workspace.store.get('invoice',invoice.id,workspace.manager.tenantId).status).toBe('void');});
 await open(page);await decision(page,'Close delivery','load:close',async()=>{await expect(page.getByRole('button',{name:'Close delivery'})).toHaveCount(0);expect(workspace.store.get('load',load.id,workspace.manager.tenantId).closedAt).toBeTruthy();});
});
