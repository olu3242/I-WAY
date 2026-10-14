import {test as base,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {fixture,password} from '../helpers/operations-fixture.mjs';
import {makeOperationsApp} from '../../server/operations-app.mjs';
import {createOperationsFeatures} from '../../domain/operations-features.mjs';
export const test=base.extend({
 workspace:async({},use)=>{
  const cleanup=[],f=await fixture({after:fn=>cleanup.push(fn)},createOperationsFeatures());
  const server=makeOperationsApp({store:f.store,operations:f.ops});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const baseURL='http://127.0.0.1:'+server.address().port;
  try{await use({...f,baseURL})}finally{
   server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
   for(const fn of cleanup)await fn();
  }
 },
});
export {expect};
export async function signIn(page,workspace,actor){
 await page.goto(workspace.baseURL+'/login');
 await page.getByLabel('Username',{exact:true}).fill(actor.username);
 await page.getByLabel('Password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page).toHaveURL(workspace.baseURL+(actor.role==='customer'?'/portal':'/app'));
 await expect(page.locator('#identity')).toContainText(actor.name);
 await expect(page.locator('h1')).toHaveCount(1);
}
export async function basicAccessibility(page){
 await expect(page.locator('html')).toHaveAttribute('lang','en');
 await expect(page.locator('h1')).toHaveCount(1);
 await expect(page.getByRole('main')).toHaveCount(1);
 await expect(page.getByRole('status')).toHaveAttribute('aria-live','polite');
 const issues=await page.evaluate(()=>{
  const visible=el=>!!(el.getBoundingClientRect().width&&el.getBoundingClientRect().height);
  const problems=[];
  for(const img of document.querySelectorAll('img'))if(!img.hasAttribute('alt'))problems.push('Image has no alternative text');
  for(const control of document.querySelectorAll('input:not([type=hidden]),select,textarea')){
   if(!visible(control))continue;
   if(!(control.labels?.length||control.getAttribute('aria-label')||control.getAttribute('aria-labelledby')))problems.push('Unlabelled '+control.tagName);
  }
  for(const button of document.querySelectorAll('button'))if(visible(button)&&!((button.textContent||'').trim()||button.getAttribute('aria-label')))problems.push('Button has no name');
  if(document.documentElement.scrollWidth>innerWidth+1)problems.push('Horizontal page overflow');
  const ids=[...document.querySelectorAll('[id]')].map(el=>el.id);
  if(new Set(ids).size!==ids.length)problems.push('Duplicate element identifiers');
  return problems;
 });
 expect(issues).toEqual([]);
 await axeAccessibility(page);
}
export async function noConsoleErrors(page,run){
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await run();expect(errors).toEqual([]);
}

export async function axeAccessibility(page,label='accessibility'){
 const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
 const report={engine:results.testEngine,tags:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'],page:await page.title(),viewport:page.viewportSize(),violations:results.violations,incomplete:results.incomplete,passedRules:results.passes.map(rule=>rule.id)};
 await test.info().attach(label,{body:JSON.stringify(report,null,2),contentType:'application/json'});
 expect(results.violations.map(({id,impact,nodes})=>({id,impact,targets:nodes.map(n=>n.target),messages:nodes.map(n=>n.failureSummary)}))).toEqual([]);
 return report;
}
