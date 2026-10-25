import {test,expect,axeAccessibility} from './workspace.mjs';
import {integratedWorkspace} from './integrated-workspace.mjs';
for(const role of ['platform','carrier','fleet','driver'])test('approved brand tokens and local Inter font for '+role,async({browser})=>{
 const f=await integratedWorkspace(browser,{role,width:390}),{page}=f;
 try{
  await page.goto(f.origin+'/uat/login');await page.getByRole('button',{name:'Continue with Google'}).click();await expect(page).toHaveURL(f.origin+(role==='platform'?'/uat/control':'/app'));
  await page.evaluate(()=>document.fonts.load('700 16px Inter'));
  const typography=await page.evaluate(()=>({family:getComputedStyle(document.documentElement).fontFamily,loaded:[...document.fonts].some(f=>f.family==='Inter'&&f.status==='loaded')}));
  expect(typography.family).toContain('Inter');expect(typography.loaded).toBe(true);
  const logo=page.getByRole('img',{name:'I-way',exact:true});await expect(logo).toHaveAttribute('src','/assets/i-way-logo.svg');
  expect(await logo.evaluate(el=>getComputedStyle(el.closest('.logo-chip')).backgroundColor)).toBe('rgb(255, 255, 255)');
  const surface=page.locator('.card,.stat').first();expect(await surface.evaluate(el=>getComputedStyle(el).borderRadius)).toBe('20px');
  if(role==='driver'){await page.locator('#nav [data-tab=loads]').click();await page.getByRole('button',{name:'Open',exact:true}).first().click();expect(await page.getByRole('button',{name:'Accept assignment',exact:true}).evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(52);}
  const primary=await page.locator('button.primary').evaluateAll(nodes=>nodes.filter(el=>el.getClientRects().length).map(el=>{const c=getComputedStyle(el);return {background:c.backgroundColor,color:c.color,radius:c.borderRadius};}));
  expect(primary.length).toBeLessThanOrEqual(1);for(const token of primary)expect(token).toEqual({background:'rgb(255, 104, 28)',color:'rgb(9, 36, 72)',radius:'12px'});
  await axeAccessibility(page,'brand-'+role);await page.screenshot({path:test.info().outputPath('brand-'+role+'-390.png'),fullPage:true});expect(f.errors).toEqual([]);
  await test.info().attach('brand-token-observations',{body:JSON.stringify({kind:'brand-token-observations',role,typography,primary,comparison:'Approved repository tokens; no original Figma pixel reference available'}),contentType:'application/json'});
 }finally{await f.close();}
});
