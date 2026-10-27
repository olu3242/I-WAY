import {test,expect} from '@playwright/test';
import {createServer} from 'node:http';
import AxeBuilder from '@axe-core/playwright';
import {createHostedUatHandler} from '../../server/operations-uat-hosted-handler.mjs';
for(const width of [320,390,768,1440])test(`staging startup failure remains usable and responsive at ${width}px`,async({page})=>{
 let requests=0;
 const handler=createHostedUatHandler({logSink:()=>{},createRuntime:()=>{requests++;throw Error('synthetic unavailable');}});
 const server=createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  await page.setViewportSize({width,height:900});
  const root='http://127.0.0.1:'+server.address().port;
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  expect((await page.goto(root+'/login')).status()).toBe(503);
  await expect(page.getByRole('heading',{level:1})).toContainText('isn’t ready');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('link',{name:'Try sign-in again'}).focus();await page.keyboard.press('Enter');await expect(page).toHaveURL(root+'/uat/login');
  await page.getByText('Help with access',{exact:true}).click();await expect(page.getByText(/Request reference:/)).toBeVisible();
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await page.getByRole('link',{name:'Return to staging'}).click();await expect(page).toHaveURL(root+'/');
  expect(requests).toBeGreaterThanOrEqual(3);expect(errors).toEqual([]);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
