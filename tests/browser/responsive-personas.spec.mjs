import {test,expect,axeAccessibility} from './workspace.mjs';
import {integratedWorkspace} from './integrated-workspace.mjs';
import {durablePostgresFixture} from '../helpers/durable-uat-fixture.mjs';
import {verifiedOutcome} from './control-evidence.mjs';
const durable=process.env.IWAY_BROWSER_DURABLE_OPT_IN==='true';let postgres;
test.beforeAll(async()=>{if(durable)postgres=await durablePostgresFixture();});
test.afterAll(async()=>{if(postgres)await postgres.close();});

async function layout(page,label){
 const result=await page.evaluate(()=>{
  const visible=el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden';
  const controls=[...document.querySelectorAll('button,input:not([type=hidden]),select,textarea')].filter(visible);
  return {viewport:innerWidth,pageWidth:document.documentElement.scrollWidth,
   undersized:controls.filter(el=>{const r=el.getBoundingClientRect();return r.height<44||r.width<44;}).map(el=>el.id||el.name||el.textContent.trim()),
   clipped:controls.filter(el=>{const r=el.getBoundingClientRect();return r.left<0||r.right>innerWidth;}).filter(el=>!el.closest('.table-wrap,nav')).map(el=>el.id||el.name||el.textContent.trim())};
 });
 await test.info().attach('responsive-layout',{body:JSON.stringify({kind:'responsive-layout',label,...result}),contentType:'application/json'});
 expect(result.pageWidth,label+' page overflow').toBeLessThanOrEqual(result.viewport+1);
 expect(result.undersized,label+' touch targets').toEqual([]);
 expect(result.clipped,label+' clipped form controls').toEqual([]);
}

for(const width of [320,375,390,768,1024,1440])for(const role of ['platform','carrier','fleet','driver'])test(`responsive ${role} persisted workflow at ${width}`,async({browser})=>{
 test.setTimeout(90000);
 const f=await integratedWorkspace(browser,{role,width,postgres}),{page}=f;
 try{
  await page.goto(f.origin+'/uat/login');await page.getByRole('button',{name:'Continue with Google'}).click();
  await expect(page).toHaveURL(f.origin+(role==='platform'?'/uat/control':'/app'));
  await expect(page.locator('h1')).toBeVisible();
  if(role==='platform'){
   await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Skip to administration'})).toBeFocused();
   await page.keyboard.press('Enter');await expect(page.locator('#main')).toBeFocused();
   await page.getByRole('button',{name:'View administration activity'}).press('Enter');
   await verifiedOutcome('button:View administration activity',async()=>{await expect(page.locator('#activity')).toContainText('platform:audit');});
   await layout(page,'platform-audit');await axeAccessibility(page,'responsive-platform-audit');
  }else{
   const tabs=await page.locator('#nav button').evaluateAll(nodes=>nodes.map(n=>n.dataset.tab));
   for(const id of tabs){
    await page.locator('#nav [data-tab="'+id+'"]').press('Enter');
    await expect(page.locator('h1')).toBeFocused();await expect(page.locator('#nav [data-tab="'+id+'"]')).toHaveAttribute('aria-current','page');
    await layout(page,role+'-'+id);
   }
   // A real local write, then a fresh app instance/reload confirms persistence.
   await page.locator('#nav [data-tab="notifications"]').click();
   await page.getByLabel('Shipment notifications').selectOption('no');await page.getByRole('button',{name:'Save preferences'}).press('Enter');
   await expect(page.getByRole('status')).toContainText('Saved.');
   await f.restart();await page.reload();await page.locator('#nav [data-tab="notifications"]').click();
   await verifiedOutcome('form:notification-preference',async()=>{await expect(page.getByLabel('Shipment notifications')).toHaveValue('no');});
   await layout(page,role+'-persisted-form');await axeAccessibility(page,'responsive-'+role+'-form');
   await page.locator('#nav [data-tab="loads"]').click();
   const table=page.getByRole('region',{name:'Scrollable records'}).first();
   if(await table.count()){
    await table.focus();await expect(table).toBeFocused();
    const before=await table.evaluate(el=>({left:el.scrollLeft,overflow:el.scrollWidth>el.clientWidth}));
    if(before.overflow){await table.press('ArrowRight');await expect.poll(()=>table.evaluate(el=>el.scrollLeft)).toBeGreaterThan(before.left);}
   }
   await page.getByRole('button',{name:'Open',exact:true}).first().click();await layout(page,role+'-load-detail');
   if(role==='driver'){
    await page.getByRole('button',{name:'Accept assignment'}).press('Enter');await expect(page.getByRole('button',{name:'Complete pickup'})).toBeVisible();
    await f.restart();await page.reload();await page.locator('#nav [data-tab="loads"]').click();await page.getByRole('button',{name:'Open',exact:true}).first().click();
    await expect(page.getByRole('button',{name:'Complete pickup'})).toBeVisible();await layout(page,'driver-accepted');
   }
   if(role==='carrier'){
    const button=page.getByRole('button',{name:'Void load'});await button.focus();page.once('dialog',dialog=>dialog.dismiss());await button.press('Enter');await expect(button).toBeFocused();await expect(button).toBeEnabled();
    await page.goto(f.origin+'/admin');await expect(page.locator('#notice')).toHaveText('Ready');
    await layout(page,'carrier-administration');await axeAccessibility(page,'responsive-administration');
    await page.getByLabel('Legal name',{exact:true}).fill('Illustrative responsive saved company');await page.getByRole('button',{name:'Save company settings'}).press('Enter');await expect(page.locator('#notice')).toHaveText('Company settings saved');
    await f.restart();await page.reload();await expect(page.getByLabel('Legal name',{exact:true})).toHaveValue('Illustrative responsive saved company');await page.getByRole('link',{name:'Operations',exact:true}).click();
   }
  }
  await page.screenshot({path:test.info().outputPath(role+'-'+width+'.png'),fullPage:true});
  await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Sign out',exact:true}).press('Enter');await expect(page).toHaveURL(f.origin+'/uat/login');
  expect(f.errors).toEqual([]);
  await test.info().attach('responsive-workflow',{body:JSON.stringify({kind:'responsive-workflow',role,width,scope:'LOCAL_SYNTHETIC_AUTH',backend:durable?'disposable PostgreSQL':'disposable SQLite',hostedAuthentication:false,persistence:'verified after restart/reload',keyboard:'PASS',nativeDialogAssistiveTechnology:'NOT RUN'}),contentType:'application/json'});
 }finally{await f.close();}
});

test('keyboard sign-out remains usable when initial workspace state is unavailable',async({browser})=>{
 const f=await integratedWorkspace(browser,{role:'carrier',width:375,postgres}),{page}=f;
 let release;const scriptReady=new Promise(resolve=>release=resolve);
 try{
  await page.goto(f.origin+'/uat/login');await page.getByRole('button',{name:'Continue with Google'}).click();
  await expect(page.locator('#identity')).toContainText('carrier');
  await page.route('**/api/ops/state',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"Illustrative state unavailable"}'}));
  await page.route('**/assets/ops.js',async route=>{await scriptReady;await route.fallback();});
  await page.reload({waitUntil:'commit'});
  await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeDisabled();release();
  await expect(page.getByRole('alert')).toHaveText('Illustrative state unavailable');
  await page.getByRole('button',{name:'Sign out',exact:true}).press('Enter');
  await verifiedOutcome('button:Sign out',async()=>{await expect(page).toHaveURL(f.origin+'/uat/login');});
  const status=await page.evaluate(async()=> (await fetch('/api/ops/session')).status);expect(status).toBe(401);
  expect(f.errors).toEqual([]);
 }finally{release();await f.close();}
});
