import {test,expect} from '@playwright/test';
import {makeApp} from '../../server/app.mjs';
import {resolve} from 'node:path';
for(const width of [390,1440])test('public preview is keyboard operable without sending data at '+width+'px',async({page})=>{
 const server=makeApp({root:resolve('site/public'),register:()=>{throw Error('Preview must not send');}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(r.method()==='POST')requests.push(r.url());});
 // Font network availability is separate from the local functional test.
 await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
 try{
  await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:'+server.address().port+'/early-access.html');
  await expect(page.locator('#preview-banner')).toBeVisible();
  if(width===390){await page.locator('.nav-toggle').focus();await page.keyboard.press('Enter');await expect(page.locator('.nav-toggle')).toHaveAttribute('aria-expanded','true');await expect(page.locator('#site-nav')).toBeVisible();}
  await page.locator('#name').fill('Illustrative tester');await page.locator('#email').fill('tester@illustrative.invalid');await page.locator('#company').fill('Illustrative business');await page.locator('#role').selectOption('carrier');
  await page.locator('#ea-submit').focus();await page.keyboard.press('Enter');await expect(page.locator('#ea-success-preview')).toBeVisible();await expect(page.locator('#ea-success-ok')).toBeHidden();await expect(page.locator('#ea-next')).toBeHidden();
  expect(requests).toEqual([]);expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#ea-edit').click();await expect(page.locator('#ea-form')).toBeVisible();
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
