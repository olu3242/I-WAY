import {test,expect,signIn,basicAccessibility} from './workspace.mjs';
import {verifiedJourney,verifiedOutcome} from './control-evidence.mjs';
test('driver can cancel a rejection prompt or reject with reason; carrier sees released assignment',async({page,workspace})=>{
 const load=workspace.assign();await signIn(page,workspace,workspace.driver);await page.locator('#nav [data-tab=loads]').click();await page.getByRole('button',{name:'Open',exact:true}).click();
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Reject assignment',exact:true}).click();await expect(page.getByRole('button',{name:'Accept assignment',exact:true})).toBeEnabled();
 page.once('dialog',d=>d.accept('Illustrative shift unavailable'));await page.getByRole('button',{name:'Reject assignment',exact:true}).press('Enter');
 await verifiedOutcome('action:load:reject',async()=>{
  // The detail view already has no Open button. Wait for the mutation itself,
  // then verify the driver's refreshed view and released resource claims.
  await expect.poll(()=>workspace.store.get('load',load.id,load.tenantId).status).toBe('validated');
  expect(workspace.store.get('load',load.id,load.tenantId).driverId).toBeNull();
  expect(workspace.store.list('assignment',load.tenantId).filter(a=>a.loadId===load.id&&a.status==='active')).toHaveLength(0);
  await expect(page.getByRole('status')).toContainText('Operation saved.');
  await expect(page.getByRole('button',{name:'Accept assignment',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Open',exact:true})).toHaveCount(0);
 });await basicAccessibility(page);
 await signIn(page,workspace,workspace.manager);
 await page.getByRole('button',{name:'Loads',exact:true}).click();
 await page.getByRole('row').filter({hasText:load.reference}).getByRole('button',{name:'Open',exact:true}).click();
 await expect(page.locator('h1')).toHaveText(load.reference);
 await expect(page.locator('#view')).toContainText('Not assigned');
});
test('load search and active/completed filters return only matching tenant records',async({page,workspace})=>{
 const a=workspace.createLoad(),b=workspace.createLoad();workspace.command(workspace.manager,'load:void',b,{reason:'Illustrative void for completed filter'});await signIn(page,workspace,workspace.manager);await page.locator('#nav [data-tab=loads]').click();
 await page.getByLabel('Search loads',{exact:true}).fill(a.reference);await page.getByRole('button',{name:'Search loads',exact:true}).click();
 await verifiedJourney(['form:load-search','button:Search loads'],async()=>{await expect(page.getByRole('button',{name:'Open',exact:true})).toHaveCount(1);await expect(page.locator('#view')).toContainText(a.reference);await expect(page.locator('tbody')).not.toContainText(b.reference);});
 await page.getByLabel('Search loads',{exact:true}).fill('');await page.getByLabel('Load list',{exact:true}).selectOption('completed');await page.getByRole('button',{name:'Search loads',exact:true}).press('Enter');await expect(page.locator('tbody')).toContainText(b.reference);await expect(page.locator('tbody')).not.toContainText(a.reference);
 await page.getByLabel('Search loads',{exact:true}).fill('no-such-illustrative-load');await page.getByRole('button',{name:'Search loads',exact:true}).click();await expect(page.locator('#view')).toContainText('0 matching loads');await basicAccessibility(page);
});
