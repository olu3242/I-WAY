import {readFileSync} from 'node:fs';
import {test,expect,axeAccessibility} from './workspace.mjs';
import {integratedWorkspace} from './integrated-workspace.mjs';
const matrix=JSON.parse(readFileSync('docs/certification/harmonized-figma/matrix.json','utf8'));
// The fixture uses local synthetic identity only; no external OAuth, mail or hosted writes.
for(const width of [390,1440])for(const role of ['platform','carrier','fleet','driver'])test(`harmonized route and loaded asset contract for ${role} at ${width}`,async({browser})=>{
 test.setTimeout(120000);
 const f=await integratedWorkspace(browser,{role,width,platformPermissions:['platform:audit','platform:cases','platform:configure','platform:support']}),{page}=f,assetFailures=[];
 page.on('response',r=>{if(new URL(r.url()).pathname.startsWith('/assets/')&&r.status()>=400)assetFailures.push({path:new URL(r.url()).pathname,status:r.status()});});
 try{
  await page.goto(f.origin+'/uat/login');await page.getByRole('button',{name:'Continue with Google'}).click();await expect(page).toHaveURL(f.origin+(role==='platform'?'/uat/control':'/app'));
  const logo=page.locator('img[src="/assets/i-way-logo.svg"]');await expect(logo).toBeVisible();await expect.poll(()=>logo.evaluate(el=>el.complete&&el.naturalWidth>0)).toBe(true);
  const response=await page.evaluate(async()=>{const r=await fetch('/assets/i-way-logo.svg');return {status:r.status,type:r.headers.get('content-type')};});expect(response.status).toBe(200);expect(response.type).toContain('image/svg+xml');
  if(role==='platform'){
   await expect(page.getByRole('heading',{name:'Cases and configuration'})).toBeVisible();
   await expect(page.getByRole('button',{name:'Create support case'})).toBeVisible();
   expect(await page.evaluate(async()=>(await fetch('/api/ops/state')).status)).toBe(403);
  }else{
   const expected=[...new Set(matrix.screens.filter(s=>s.persona===role).flatMap(s=>s.navigation).filter(s=>!s.startsWith('#')))];
   for(const id of expected){
    const button=page.locator('#nav [data-tab="'+id+'"]');await expect(button,id+' remains reachable').toHaveCount(1);await button.press('Enter');
    await expect(button).toHaveAttribute('aria-current','page');await expect(page.locator('h1')).toHaveCount(1);await expect(page.locator('h1')).toBeFocused();
   }
   // Every newer current navigation entry is retained, even when absent from the prototype.
   const actual=await page.locator('#nav [data-tab]').evaluateAll(nodes=>nodes.map(n=>n.dataset.tab));
   expect(actual).toContain('expenses');expect(actual).toContain('onboarding');
   if(role==='carrier')for(const id of ['tower','runtime','integrations','governance','costs'])expect(actual).toContain(id);
   await page.locator('#nav [data-tab="loads"]').click();
  }
  await axeAccessibility(page,'harmonized-'+role+'-'+width);await page.screenshot({path:test.info().outputPath(role+'-'+width+'.png'),fullPage:true});
  expect(assetFailures).toEqual([]);expect(f.errors).toEqual([]);
  await test.info().attach('harmonization-scope',{body:JSON.stringify({role,width,rootScreenMapping:true,loadedLogo:true,visualReference:'BLOCKED_REFERENCE',hostedAuthentication:false}),contentType:'application/json'});
 }finally{await f.close();}
});
