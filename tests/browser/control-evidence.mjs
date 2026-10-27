import {test} from '@playwright/test';
const runs=new WeakMap(),tracked=new WeakSet();
export async function trackControls(page){
 if(tracked.has(page))return;tracked.add(page);const info=test.info();
 if(!runs.has(info))runs.set(info,{kind:'mvp-control-evidence',observed:[],interactions:[],verifiedOutcomes:[]});
 const evidence=runs.get(info),seen=new Set();
 await page.exposeFunction('__iwayControlEvidence',(kind,control)=>{for(const alias of [control.key,...(control.aliases??[])]){const value={...control,key:alias};delete value.aliases;const key=kind+JSON.stringify(value);if(seen.has(key))continue;seen.add(key);evidence[kind].push(value);}});
 await page.addInitScript(()=>{
  const describe=el=>({tag:el.tagName.toLowerCase(),key:el.dataset.action?'action:'+el.dataset.action:el.dataset.tab?'navigation:'+el.dataset.tab:el.tagName==='FORM'?'form:'+el.id:['INPUT','SELECT','TEXTAREA'].includes(el.tagName)?'field:'+(el.name||el.id):el.id?'id:'+el.id:el.closest('form')?'form:'+el.closest('form').id:el.tagName==='A'?'link:'+el.getAttribute('href'):'button:'+el.textContent.trim(),aliases:el.tagName==='BUTTON'?['button:'+el.textContent.trim()]:[],label:['BUTTON','A','SUMMARY'].includes(el.tagName)?el.textContent.trim().slice(0,120):null,path:location.pathname});
  let pending=false;const scan=()=>{pending=false;for(const el of document.querySelectorAll('a,button,input:not([type=hidden]),select,textarea,summary,form'))if(!el.disabled&&el.getClientRects().length)window.__iwayControlEvidence('observed',describe(el));};
  addEventListener('DOMContentLoaded',()=>{scan();new MutationObserver(()=>{if(!pending){pending=true;setTimeout(scan,30);}}).observe(document.body,{subtree:true,childList:true,attributes:true});});
  addEventListener('click',e=>{const el=e.target.closest('a,button,summary');if(el&&!el.disabled)window.__iwayControlEvidence('interactions',describe(el));},true);
  addEventListener('submit',e=>window.__iwayControlEvidence('interactions',describe(e.target)),true);
  addEventListener('change',e=>{if(e.target.matches('input,select,textarea'))window.__iwayControlEvidence('interactions',describe(e.target));},true);
 });
}
export async function verifiedOutcome(key,assertion){await assertion();const info=test.info();if(!runs.has(info))runs.set(info,{kind:'mvp-control-evidence',observed:[],interactions:[],verifiedOutcomes:[]});runs.get(info).verifiedOutcomes.push(key);}
export async function verifiedJourney(keys,assertion){await assertion();for(const key of keys)await verifiedOutcome(key,async()=>{});}
export async function attachControlEvidence(){const info=test.info(),evidence=runs.get(info);if(evidence)await info.attach('mvp-control-evidence',{body:JSON.stringify(evidence),contentType:'application/json'});}
