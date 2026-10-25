import {test,expect,signIn,axeAccessibility} from './workspace.mjs';
import {verifiedOutcome} from './control-evidence.mjs';
async function ready(page){await expect.poll(()=>page.evaluate(()=>!!window.iwayOffline)).toBe(true);await expect(page.getByRole('region',{name:'Device action queue'})).toBeVisible();await expect.poll(()=>page.evaluate(async()=> (await fetch('/api/ops/offline/context')).status)).toBe(200);}
async function open(page){await page.locator('#nav [data-tab="loads"]').click();await page.getByRole('button',{name:'Open',exact:true}).first().click();}
async function stored(page){return page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('iway-driver-queue-v1',1);r.onsuccess=()=>{const t=r.result.transaction('commands'),g=t.objectStore('commands').getAll();g.onsuccess=()=>resolve(g.result);g.onerror=reject;};r.onerror=reject;}));}

test('driver offline pickup survives reload, replays once and purges on sign-out',async({page,context,workspace})=>{
 const load=workspace.assign();workspace.command(workspace.driver,'load:accept',load);await page.setViewportSize({width:390,height:844});await signIn(page,workspace,workspace.driver);await ready(page);await open(page);
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
 const cachePaths=await page.evaluate(async()=>{const keys=await caches.keys(),paths=[];for(const key of keys)for(const request of await(await caches.open(key)).keys())paths.push(new URL(request.url).pathname);return paths;});expect(cachePaths.sort()).toEqual(['/assets/InterVariable.woff2','/assets/driver-offline.mjs','/assets/ops.css','/domain/driver-offline-replay.mjs','/offline'].sort());
 await context.setOffline(true);await page.getByRole('button',{name:'Complete pickup'}).click();await expect(page.getByRole('status')).toContainText('Queued on device');expect(workspace.store.get('load',load.id,workspace.driver.tenantId).status).toBe('accepted');
 const before=await stored(page);expect(before).toHaveLength(1);expect(before[0].envelope.payload).toEqual({stopId:load.stops[0].id});
 await page.reload();await expect(page.getByRole('heading',{name:'Connection unavailable'})).toBeVisible();expect((await stored(page))[0].envelope.idempotencyKey).toBe(before[0].envelope.idempotencyKey);
 await context.setOffline(false);await page.getByRole('link',{name:'Reconnect to workspace'}).click();await ready(page);await page.getByRole('button',{name:'Retry queued actions'}).click();
 await verifiedOutcome('button:Retry queued actions',async()=>{await expect(page.locator('.queue-status')).toHaveText('Confirmed by server.');expect(workspace.store.get('load',load.id,workspace.driver.tenantId).status).toBe('picked_up');});
 expect(workspace.store.db.prepare("SELECT count(*) AS n FROM audit WHERE action='load:pickup' AND outcome='success'").get().n).toBe(1);expect(await stored(page)).toHaveLength(0);await axeAccessibility(page,'offline-reconnected');
 await page.getByRole('button',{name:'Sign out',exact:true}).click();expect(await stored(page)).toHaveLength(0);
});

test('lost receipt preserves original key and retry confirms one server effect',async({page,workspace})=>{
 const load=workspace.assign();await signIn(page,workspace,workspace.driver);await ready(page);await open(page);
 let lose=true;await page.route('**/api/ops/offline',async route=>{if(lose){lose=false;await route.fetch();await route.abort();}else await route.continue();});
 await page.getByRole('button',{name:'Accept assignment'}).click();await expect(page.getByRole('alert')).toContainText('not confirmed');expect(workspace.store.get('load',load.id,workspace.driver.tenantId).status).toBe('accepted');const before=await stored(page);expect(before).toHaveLength(1);
 await page.reload();await ready(page);await page.getByRole('button',{name:'Retry queued actions'}).click();await expect(page.locator('.queue-status')).toHaveText('Confirmed by server.');expect(await stored(page)).toHaveLength(0);expect(workspace.store.db.prepare("SELECT count(*) AS n FROM audit WHERE action='load:accept' AND outcome='success'").get().n).toBe(1);
});

test('queued action cancellation is keyboard accessible and never executes',async({page,context,workspace})=>{
 const load=workspace.assign();await signIn(page,workspace,workspace.driver);await ready(page);await open(page);await context.setOffline(true);await page.getByRole('button',{name:'Accept assignment'}).click();await expect(page.getByRole('status')).toContainText('Queued on device');
 await page.getByRole('button',{name:'Cancel queued action'}).press('Enter');await verifiedOutcome('button:Cancel queued action',async()=>{await expect(page.getByRole('button',{name:'Cancel queued action'})).toHaveCount(0);await expect(page.getByRole('heading',{name:'Device action queue'})).toBeFocused();expect(await stored(page)).toHaveLength(0);expect(workspace.store.get('load',load.id,workspace.driver.tenantId).status).toBe('assigned');});await context.setOffline(false);
});
