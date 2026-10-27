import {test,expect,signIn,basicAccessibility} from './workspace.mjs';

for(const width of [1440,390]){
 test('carrier administration settings persist at '+width+'px',async({page,workspace})=>{
  await page.setViewportSize({width,height:900});
  await signIn(page,workspace,workspace.manager);
  await page.goto(workspace.baseURL+'/admin');
  await expect(page.locator('#settings')).toBeVisible();
  await basicAccessibility(page);
  const result=await page.evaluate(async()=>{
   const settings=await fetch('/api/ops/admin/settings').then(r=>r.json());
   return {ok:settings.ok,version:settings.version};
  });
  expect(result.ok).toBe(true);
  await expect(page.locator('#notice')).toContainText('Ready');
 });
}
test('noncarrier cannot open administration page or read its APIs',async({page,workspace})=>{
 await signIn(page,workspace,workspace.dispatcher);
 const response=await page.goto(workspace.baseURL+'/admin');
 expect(response.status()).toBe(403);
 const result=await page.evaluate(async()=>{
  const r=await fetch('/api/ops/admin/settings');return {status:r.status,body:await r.json()};
 });
 expect(result.status).toBe(403);
 expect(result.body.code).toBe('FORBIDDEN');
});
test('anonymous administration redirects to sign in',async({page,workspace})=>{
 await page.goto(workspace.baseURL+'/admin');
 await expect(page).toHaveURL(/\/login$/);
});
