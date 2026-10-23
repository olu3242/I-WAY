import {test,expect} from './workspace.mjs';
import {trackControls,verifiedJourney} from './control-evidence.mjs';
import {createServer} from 'node:http';
import {uatFixture,syntheticRoster,syntheticPassword} from '../helpers/uat-fixture.mjs';
import {createUatCandidateHttp} from '../../server/operations-uat-http.mjs';
// HTTPS origin is intercepted into a loopback fixture; no provider/mail request leaves this process.
for(const width of [390,1440])test('isolated UAT password setup, Google choice and MFA browser flow at '+width,async({browser})=>{
 const f=uatFixture(),origin='https://uat.illustrative.invalid',transactions=new Map();
 const handler=createUatCandidateHttp({origin,workflow:f.workflow,
  googleProvider:{authorizationUrl:()=>origin+'/auth/callback?code=synthetic',exchangeCode:async()=>f.tokens(syntheticRoster[3].userId)},
  transactions:{save:async tx=>transactions.set(tx.state,tx),consume:async key=>{const tx=transactions.get(key);transactions.delete(key);return tx;}},authorizeResource:async()=>false});
 const server=createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(origin+'/**',async route=>{
  const request=route.request(),url=new URL(request.url());const response=await route.fetch({url:base+url.pathname+url.search,maxRedirects:0,headers:{...request.headers(),origin},postData:request.postData()??undefined});
  await route.fulfill({response});
 });
 try{
  await trackControls(page);
  await f.workflow.issue({adminSession:'synthetic-approved-admin',userId:syntheticRoster[1].userId});
  await page.goto(origin+'/uat/setup#'+f.mail[0].token);await expect(page).toHaveURL(origin+'/uat/setup');
  await page.getByLabel('New password').fill(syntheticPassword);await page.getByRole('button',{name:'Set password',exact:true}).click();await expect(page.getByRole('status')).toContainText('Password set');
  await page.getByRole('link',{name:'Return to sign in'}).click();await expect(page.getByRole('button',{name:'Continue with Google'})).toBeVisible();
  await page.getByLabel('Email',{exact:true}).fill(syntheticRoster[1].email);await page.getByLabel('Password',{exact:true}).fill(syntheticPassword);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('status')).toContainText('authenticator code');
  await page.getByLabel('Authenticator code').fill('123456');await page.getByRole('button',{name:'Verify',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Signed in.');
  const identity=await page.evaluate(async()=>{const r=await fetch('/uat/session');return r.json();});expect(identity).toEqual({authenticated:true,role:'carrier'});
  expect(await page.evaluate(()=>document.cookie)).not.toContain('iway');expect(errors).toEqual([]);
  await verifiedJourney(['form:credentials','form:mfa','button:Set password','button:Sign in','button:Verify'],async()=>{expect(identity).toEqual({authenticated:true,role:'carrier'});});
 }finally{await context.close();server.closeAllConnections();await new Promise(r=>server.close(r));f.db.close();}
});
