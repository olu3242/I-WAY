import {test,expect,signIn,basicAccessibility} from './workspace.mjs';
import {verifiedJourney,verifiedOutcome} from './control-evidence.mjs';
test('driver can cancel a rejection prompt or reject with reason; carrier sees released assignment',async({page,workspace})=>{
 const load=workspace.assign();await signIn(page,workspace,workspace.driver);await page.locator('#nav [data-tab=loads]').click();await page.getByRole('button',{name:'Open',exact:true}).click();
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Reject assignment',exact:true}).click();await expect(page.getByRole('button',{name:'Accept assignment',exact:true})).toBeEnabled();
 page.once('dialog',d=>d.accept('Illustrative shift unavailable'));await page.getByRole('button',{name:'Reject assignment',exact:true}).press('Enter');
 await verifiedOutcome('action:load:reject',async()=>{await expect(page.getByRole('button',{name:'Open',exact:true})).toHaveCount(0);expect(workspace.store.get('load',load.id,load.tenantId).status).toBe('validated');});await basicAccessibility(page);
});
test('load search and active/completed filters return only matching tenant records',async({page,workspace})=>{
 const a=workspace.createLoad(),b=workspace.createLoad();workspace.command(workspace.manager,'load:void',b,{reason:'Illustrative void for completed filter'});await signIn(page,workspace,workspace.manager);await page.locator('#nav [data-tab=loads]').click();
 await page.getByLabel('Search loads',{exact:true}).fill(a.reference);await page.getByRole('button',{name:'Search loads',exact:true}).click();
 await verifiedJourney(['form:load-search','button:Search loads'],async()=>{await expect(page.getByRole('button',{name:'Open',exact:true})).toHaveCount(1);await expect(page.locator('#view')).toContainText(a.reference);await expect(page.locator('tbody')).not.toContainText(b.reference);});
 await page.getByLabel('Search loads',{exact:true}).fill('');await page.getByLabel('Load list',{exact:true}).selectOption('completed');await page.getByRole('button',{name:'Search loads',exact:true}).press('Enter');await expect(page.locator('tbody')).toContainText(b.reference);await expect(page.locator('tbody')).not.toContainText(a.reference);
 await page.getByLabel('Search loads',{exact:true}).fill('no-such-illustrative-load');await page.getByRole('button',{name:'Search loads',exact:true}).click();await expect(page.locator('#view')).toContainText('0 matching loads');await basicAccessibility(page);
});
