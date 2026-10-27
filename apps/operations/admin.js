const notice=document.querySelector('#notice'),settings=document.querySelector('#settings'),kind=document.querySelector('#kind');
let csrf='',settingsVersion=0,principalId='';
const pending=new WeakSet();
function begin(form){if(pending.has(form))return false;pending.add(form);form.querySelector('button[type=submit],button').disabled=true;return true;}
function finish(form){pending.delete(form);form.querySelector('button[type=submit],button').disabled=false;}
const say=(s,error=false)=>{notice.setAttribute('role',error?'alert':'status');notice.setAttribute('aria-live',error?'assertive':'polite');notice.tabIndex=-1;notice.textContent=s;if(s!=='Ready')notice.focus();};
const resetEditor=()=>{document.querySelector('#editor').reset();document.querySelector('#delete').disabled=true;};
async function api(path,method='GET',body){
 if(method==='POST'){
  const session=await api('/api/ops/session');
  if(session.actor.id!==principalId)throw Error('Session changed. Reload administration.');
  csrf=session.csrf;
 }
 const r=await fetch(path,{method,headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:body===undefined?undefined:JSON.stringify(body)});
 if(r.status===401){location.assign('/login');throw Error('Sign in required')}
 const x=await r.json();if(!r.ok||x.ok===false)throw Error(x.code||x.error||'Request failed');return x;
}
async function refresh(){
 const session=await api('/api/ops/state');csrf=session.csrf;principalId=session.actor.id;
 const response=await api('/api/ops/admin/settings');settingsVersion=response.version;
 for(const [k,v] of Object.entries(response.settings))if(settings.elements.namedItem(k))settings.elements.namedItem(k).value=v;
 settings.hidden=false;await refreshItems();await refreshAudit();say('Ready');
}
async function refreshItems(){
 const response=await api('/api/ops/admin/items?kind='+encodeURIComponent(kind.value));
 const list=document.querySelector('#items');list.replaceChildren();
 if(!response.items.length){list.textContent='No records configured';return}
 const ul=document.createElement('ul');
 for(const item of response.items){
  const li=document.createElement('li'),btn=document.createElement('button');btn.type='button';btn.textContent=item.name+' (v'+item.version+')';
  btn.addEventListener('click',()=>{document.querySelector('#record-id').value=item.id;document.querySelector('#version').value=item.version;const {id,version,...data}=item;document.querySelector('#data').value=JSON.stringify(data,null,2);document.querySelector('#delete').disabled=false;document.querySelector('#record-id').focus();});
  li.append(btn);ul.append(li);
 }list.append(ul);
}
async function refreshAudit(){
 const r=await api('/api/ops/admin/audit'),box=document.querySelector('#audit');box.replaceChildren();
 const ul=document.createElement('ul');for(const x of r.events){const li=document.createElement('li');li.textContent=x.kind+' · '+x.operation+' · version '+x.version;ul.append(li)}box.append(ul);
}
settings.addEventListener('submit',async e=>{e.preventDefault();if(!begin(settings))return;try{
 const data=Object.fromEntries(new FormData(settings));for(const k of Object.keys(data))if(!data[k])delete data[k];
 await api('/api/ops/admin/settings','POST',{settings:data,expectedVersion:settingsVersion});await refresh();say('Company settings saved');
}catch(e){say(e.message,true)}finally{finish(settings);}});
kind.addEventListener('change',()=>{resetEditor();refreshItems().catch(e=>say(e.message,true));});
document.querySelector('#editor').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;if(!begin(form))return;try{
 const data=JSON.parse(document.querySelector('#data').value);
 const saved=await api('/api/ops/admin/items','POST',{kind:kind.value,id:document.querySelector('#record-id').value,expectedVersion:Number(document.querySelector('#version').value),data});
 document.querySelector('#version').value=saved.version;document.querySelector('#delete').disabled=false;
 await refreshItems();await refreshAudit();say('Configuration saved');
}catch(e){say(e.message,true)}finally{finish(form);}});
document.querySelector('#delete').addEventListener('click',async()=>{const form=document.querySelector('#editor');if(pending.has(form)||!confirm('Deactivate this configuration?')||!begin(form))return;try{
 await api('/api/ops/admin/delete','POST',{kind:kind.value,id:document.querySelector('#record-id').value,expectedVersion:Number(document.querySelector('#version').value)});
 resetEditor();await refreshItems();await refreshAudit();say('Configuration deactivated');
}catch(e){say(e.message,true)}finally{finish(form);}});
refresh().catch(e=>say(e.message,true));
