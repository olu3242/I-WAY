import {test,expect,signIn} from './workspace.mjs';

test('B21 driver inspects session-bound IndexedDB queue without enabling capture or replay',async({page,workspace})=>{
 await signIn(page,workspace,workspace.driver);
 await page.getByRole('button',{name:'Offline readiness'}).click();
 await page.getByRole('button',{name:'Inspect pending work'}).click();
 await expect(page.getByText('0 pending offline command(s) on this device. Submission and synchronization remain disabled.')).toBeVisible();
 await expect(page.getByText('Offline server submission is not available while disconnected.',{exact:false})).toBeVisible();
});
test('B21 disconnected inspection fails closed without claiming queue success',async({page,workspace})=>{
 await signIn(page,workspace,workspace.driver);
 await page.getByRole('button',{name:'Offline readiness'}).click();
 await page.context().setOffline(true);
 await page.getByRole('button',{name:'Inspect pending work'}).click();
 await expect(page.getByText('Pending work could not be verified. No command was submitted or removed.')).toBeVisible();
 await page.context().setOffline(false);
});
