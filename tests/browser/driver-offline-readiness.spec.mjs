import {test,expect,signIn,basicAccessibility} from './workspace.mjs';

test('B19 driver offline readiness is accessible and does not submit commands',async({page,workspace})=>{
 await signIn(page,workspace,workspace.driver);
 await page.getByRole('button',{name:'Offline readiness'}).click();
 await expect(page.getByRole('heading',{name:'Offline readiness'})).toBeVisible();
 await expect(page.getByText('Offline command submission is not yet enabled.',{exact:false})).toBeVisible();
 await basicAccessibility(page);
 await page.getByRole('button',{name:'Check server connection'}).click();
 await expect(page.getByText('Server connection verified.')).toBeVisible();
});
test('B19 driver offline state never claims successful command submission',async({page,workspace})=>{
 await signIn(page,workspace,workspace.driver);
 await page.getByRole('button',{name:'Offline readiness'}).click();
 await page.context().setOffline(true);
 await expect(page.getByText('Browser reports offline')).toBeVisible();
 await page.getByRole('button',{name:'Check server connection'}).click();
 await expect(page.getByText('Server connection unavailable. No action was submitted.')).toBeVisible();
 await page.context().setOffline(false);
});
