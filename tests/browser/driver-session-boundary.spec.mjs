import {test,expect,signIn} from './workspace.mjs';

// FCC-03 B20: actual HTTP session boundary across driver/carrier personas.
// This does not yet certify offline replay integration.
test('B20 driver logout invalidates driver API access before carrier sign-in',async({page,workspace})=>{
 await signIn(page,workspace,workspace.driver);
 // Browser context is the authority; APIRequestContext may not share its cookie jar.
 const active=await page.evaluate(async()=>{
  const r=await fetch('/api/ops/state',{credentials:'same-origin'});
  return {status:r.status,role:r.ok?(await r.json()).actor.role:null};
 });
 expect(active).toEqual({status:200,role:'driver'});
 await page.getByRole('button',{name:/log out|sign out/i}).click();
 await expect(page).toHaveURL(workspace.baseURL+'/login');
 const revoked=await page.evaluate(async()=>({status:(await fetch('/api/ops/state',{credentials:'same-origin'})).status}));
 expect(revoked.status).toBe(401);
 await signIn(page,workspace,workspace.manager);
 const carrier=await page.evaluate(async()=>{
  const r=await fetch('/api/ops/state',{credentials:'same-origin'});
  return {status:r.status,role:r.ok?(await r.json()).actor.role:null};
 });
 expect(carrier).toEqual({status:200,role:'carrier'});
});
