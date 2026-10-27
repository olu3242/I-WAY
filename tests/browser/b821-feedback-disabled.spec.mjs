import {test,expect,signIn,basicAccessibility} from './workspace.mjs';
test('existing native carrier login leaves unapproved feedback disabled with no extra controls or announcements',async({page,workspace})=>{
 await signIn(page,workspace,workspace.manager);
 await expect(page.locator('#uat-feedback')).toHaveAttribute('aria-busy','false');await expect(page.locator('#uat-feedback')).toBeHidden();
 await expect(page.getByRole('button',{name:'Refresh UAT feedback'})).toHaveCount(0);await expect(page.getByRole('status')).toHaveCount(1);
 const result=await page.evaluate(async()=>{const csrf=(await(await fetch('/api/ops/session')).json()).csrf;const r=await fetch('/api/ops/feedback',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrf},body:'{"action":"list"}'});return {status:r.status,data:await r.json()};});
 expect(result.status).toBe(200);expect(result.data).toMatchObject({enabled:false,rows:[],events:[],owners:[]});await basicAccessibility(page);
});
