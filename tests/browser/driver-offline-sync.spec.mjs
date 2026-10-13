import {test,expect,signIn} from './workspace.mjs';

test('B21 synchronization with an empty queue never sends an operational command',async({page,workspace})=>{
 await signIn(page,workspace,workspace.driver);
 await page.getByRole('button',{name:'Offline readiness'}).click();
 let replayRequests=0;
 page.on('request',r=>{if(r.url().endsWith('/api/ops/offline-replay'))replayRequests++;});
 await page.getByRole('button',{name:'Synchronize pending work'}).click();
 await expect(page.getByText('No pending offline commands.')).toBeVisible();
 expect(replayRequests).toBe(0);
});
test('B21 synchronization while disconnected fails closed',async({page,workspace})=>{
 await signIn(page,workspace,workspace.driver);
 await page.getByRole('button',{name:'Offline readiness'}).click();
 await page.context().setOffline(true);
 await page.getByRole('button',{name:'Synchronize pending work'}).click();
 await expect(page.getByText('Synchronization not confirmed. Pending commands were retained.')).toBeVisible();
 await page.context().setOffline(false);
});
