import {readFileSync} from 'node:fs';
import {test,expect,axeAccessibility} from './workspace.mjs';
import {integratedWorkspace} from './integrated-workspace.mjs';
import {verifiedJourney} from './control-evidence.mjs';
const matrix=JSON.parse(readFileSync('docs/certification/harmonized-figma/matrix.json','utf8'));
const platformPermissions=['platform:audit','platform:cases','platform:configure','platform:support'];

// Captures are current implementation evidence, never approved Figma baselines.
for(const role of ['carrier','fleet','driver','platform'])for(const width of [390,768,1440])test(`mapped ${role} screens, keyboard navigation and bounded overflow at ${width}`,async({browser})=>{
 test.setTimeout(240000);
 const f=await integratedWorkspace(browser,{role,width,platformPermissions}),{page}=f,records=[],scanned=new Set();
 const reflow=async()=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 try{
  await page.goto(f.origin+'/uat/login');await page.getByRole('button',{name:'Continue with Google'}).click();
  await expect(page).toHaveURL(f.origin+(role==='platform'?'/uat/control':'/app'));
  if(role==='platform')await expect(page.getByRole('region',{name:'Governance totals'})).toBeVisible();
  if(role!=='platform')await expect(page.locator('#identity')).toContainText(role);
  await page.screenshot({path:test.info().outputPath('dashboard-'+role+'-'+width+'.png'),fullPage:true});
  if(role!=='platform'){
   await expect(page.locator('#identity')).toContainText(role);
   if(width===390){expect(await page.locator('.stats').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(2);}
   if(width>650){
    const sidebar=page.locator('.sidebar');expect(await sidebar.evaluate(el=>el.getBoundingClientRect().height<=innerHeight+1)).toBe(true);
    const nav=page.locator('#nav');expect(await nav.evaluate(el=>getComputedStyle(el).overflowY)).toBe('auto');
    const last=nav.locator('[data-tab]').last();await last.focus();await last.press('Enter');await expect(last).toBeInViewport();await expect(page.locator('h1')).toBeFocused();await expect(page.locator('#logout')).toBeInViewport();
   }else{
    const last=page.locator('#nav [data-tab]').last();await last.focus();await last.press('Enter');await expect(last).toBeInViewport();await expect(page.locator('h1')).toBeFocused();
   }
  }
  for(const row of matrix.screens.filter(s=>s.persona===role)){
   if(!row.route){records.push({screen:row.id,width,status:'BLOCKED_CONTRACT',capture:null,reason:row.remaining,approvedVisual:'BLOCKED_REFERENCE'});continue;}
   if(row.route==='/admin'){
    await page.goto(f.origin+'/admin');await expect(page.locator('h1')).toBeVisible();
   }else if(role==='platform'){
    const target=page.locator(row.navigation[0]);await expect(target).toBeVisible();await target.scrollIntoViewIfNeeded();
   }else{
    if(!page.url().includes('/app'))await page.goto(f.origin+'/app');
    const nav=page.locator('#nav [data-tab="'+row.navigation[0]+'"]');await nav.press('Enter');await expect(nav).toHaveAttribute('aria-current','page');await expect(page.locator('h1')).toBeFocused();
   }
   await reflow();
   const key=row.route==='/admin'?'/admin':row.navigation[0];
   if(!scanned.has(key)){await axeAccessibility(page,row.id+'-'+width);scanned.add(key);}
   const capture=row.id.replace(':','-')+'-'+width+'.png';await page.screenshot({path:test.info().outputPath(capture),fullPage:true});
   records.push({screen:row.id,width,route:row.route,navigation:row.navigation[0]??null,status:'CAPTURED_CURRENT_IMPLEMENTATION',capture,approvedVisual:'BLOCKED_REFERENCE',wholePrototypeConformity:row.status});
  }
  expect(f.errors).toEqual([]);
  await test.info().attach('mapped-screen-captures',{body:JSON.stringify(records,null,2),contentType:'application/json'});
 }finally{await f.close();}
});

test('governance initial failure announces absence of verified data and keyboard retry recovers',async({browser})=>{
 const f=await integratedWorkspace(browser,{role:'platform',width:390,platformPermissions}),{page}=f;let fail=true;
 try{
  await page.route('**/api/ops/platform/workspace',route=>fail?route.fulfill({status:503,contentType:'application/json',body:'{"error":"Illustrative unavailable governance"}'}):route.fallback());
  await page.goto(f.origin+'/uat/login');await page.getByRole('button',{name:'Continue with Google'}).click();
  await expect(page.getByRole('heading',{name:'Governance records unavailable'})).toBeVisible();await expect(page.getByRole('region',{name:'Governance totals'})).toHaveCount(0);
  await expect(page.locator('#platform-workspace')).toHaveAttribute('aria-busy','false');await expect(page.getByRole('alert')).toContainText('could not load');await axeAccessibility(page,'governance-unavailable');
  fail=false;await page.getByRole('button',{name:'Retry governance records',exact:true}).press('Enter');
  await verifiedJourney(['button:Retry governance records'],async()=>{await expect(page.getByRole('region',{name:'Governance totals'})).toBeVisible();await expect(page.getByRole('button',{name:'Retry governance records',exact:true})).toHaveCount(0);await expect(page.locator('#platform-workspace')).toHaveAttribute('aria-busy','false');});
  await expect(page.getByRole('status')).toContainText('Governance records updated.');expect(await page.evaluate(async()=>(await fetch('/api/ops/state')).status)).toBe(403);expect(f.errors).toEqual([]);await axeAccessibility(page,'governance-recovered');
 }finally{await f.close();}
});
