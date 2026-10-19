import {test,expect} from '@playwright/test';
import {once} from 'node:events';
import {makeApp} from '../../server/app.mjs';

let server,baseURL,received=[];
test.beforeAll(async()=>{
 server=makeApp({root:'site/public',register:async input=>{received.push(input);return {created:true}}});
 server.listen(0,'127.0.0.1');
 await once(server,'listening');
 baseURL='http://127.0.0.1:'+server.address().port;
});
test.afterAll(async()=>{
 if(server)await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
});
test.beforeEach(()=>{received=[];});

async function completeForm(page){
 await page.goto(baseURL+'/early-access.html');
 await page.locator('#name').fill('Sample Operator');
 await page.locator('#email').fill('operator@example.com');
 await page.locator('#role').selectOption('carrier');
 await page.locator('input[name="consent"]').check();
}

test('early access submits registration to API and renders confirmed success',async({page})=>{
 await completeForm(page);
 await page.locator('#ea-submit').click();
 await expect(page.locator('#ea-success')).toBeVisible();
 await expect(page.locator('#ea-email')).toHaveText('operator@example.com');
 await expect.poll(()=>received.length).toBe(1);
 expect(received[0]).toMatchObject({name:'Sample Operator',email:'operator@example.com',role:'carrier',consent:true});
});

test('early access does not submit without explicit consent',async({page})=>{
 await completeForm(page);
 await page.locator('input[name="consent"]').uncheck();
 await page.locator('#ea-submit').click();
 await expect(page.locator('#ea-success')).toBeHidden();
 expect(received).toHaveLength(0);
});

test('early access preserves input and displays error when API fails',async({page})=>{
 await completeForm(page);
 await page.route('**/api/early-access',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"Registration unavailable"}'}));
 await page.locator('#ea-submit').click();
 await expect(page.locator('#form-error')).toBeVisible();
 await expect(page.locator('#email')).toHaveValue('operator@example.com');
 await expect(page.locator('#ea-success')).toBeHidden();
 expect(received).toHaveLength(0);
});
