import {test,expect,signIn} from './workspace.mjs';

test('FCC-03 driver captures assigned load offline, reconnects, synchronizes once and verifies persisted state',async({page,workspace})=>{
 const assigned=workspace.assign();
 await signIn(page,workspace,workspace.driver);
 await page.getByRole('button',{name:'Offline readiness'}).click();
 await page.getByRole('button',{name:'Inspect pending work'}).click();
 await expect(page.getByText('0 pending offline command(s)',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'My assignments'}).click();
 await page.getByRole('button',{name:'Open'}).first().click();
 await expect(page.getByRole('button',{name:'Accept assignment'})).toBeVisible();
 await page.context().setOffline(true);
 await page.getByRole('button',{name:'Accept assignment'}).click();
 await expect(page.getByText('Action saved locally as pending.',{exact:false})).toBeVisible();
 expect(workspace.ops.read('load',assigned.id,workspace.driver).status).toBe('assigned');
 await page.context().setOffline(false);
 await page.getByRole('button',{name:'Offline readiness'}).click();
 await page.getByRole('button',{name:'Inspect pending work'}).click();
 await expect(page.getByText('1 pending offline command(s)',{exact:false})).toBeVisible();
 let replayCount=0;
 page.on('request',request=>{if(request.url().endsWith('/api/ops/offline-replay'))replayCount++;});
 await page.getByRole('button',{name:'Synchronize pending work'}).click();
 await expect(page.getByText('Server confirmed 1 queued action(s).')).toBeVisible();
 expect(workspace.ops.read('load',assigned.id,workspace.driver).status).toBe('accepted');
 expect(replayCount).toBe(1);
 await page.getByRole('button',{name:'Synchronize pending work'}).click();
 await expect(page.getByText('No pending offline commands.')).toBeVisible();
 expect(replayCount).toBe(1);
});
