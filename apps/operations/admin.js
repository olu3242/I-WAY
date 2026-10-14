const notice=document.querySelector('#notice'),settings=document.querySelector('#settings'),kind=document.querySelector('#kind');
let csrf='',settingsVersion=0;
const say=s=>{notice.textContent=s};
async function api(path,method='GET',body){
 const r=await fetch(path,{method,headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:body===undefined?undefined:JSON.stringify(body)});
 if(r.status===401){location.assign('/login');throw Error('Sign in required')}
 const x=await r.json();if(!r.ok||x.ok===false)throw Error(x.code||x.error||'Request failed');return x;
}
async function refresh(){
 const session=await api('/api/ops/state');csrf=session.csrf;
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
  btn.addEventListener('click',()=>{document.querySelector('#record-id').value=item.id;document.querySelector('#version').value=item.version;const {id,version,...data}=item;document.querySelector('#data').value=JSON.stringify(data,null,2)});
  li.append(btn);ul.append(li);
 }list.append(ul);
}
async function refreshAudit(){
 const r=await api('/api/ops/admin/audit'),box=document.querySelector('#audit');box.replaceChildren();
 const ul=document.createElement('ul');for(const x of r.events){const li=document.createElement('li');li.textContent=x.kind+' · '+x.operation+' · version '+x.version;ul.append(li)}box.append(ul);
}
settings.addEventListener('submit',async e=>{e.preventDefault();try{
 const data=Object.fromEntries(new FormData(settings));for(const k of Object.keys(data))if(!data[k])delete data[k];
 await api('/api/ops/admin/settings','POST',{settings:data,expectedVersion:settingsVersion});await refresh();say('Company settings saved');
}catch(e){say(e.message)}});
kind.addEventListener('change',()=>refreshItems().catch(e=>say(e.message)));
document.querySelector('#editor').addEventListener('submit',async e=>{e.preventDefault();try{
 const data=JSON.parse(document.querySelector('#data').value);
 await api('/api/ops/admin/items','POST',{kind:kind.value,id:document.querySelector('#record-id').value,expectedVersion:Number(document.querySelector('#version').value),data});
 await refreshItems();await refreshAudit();say('Configuration saved');
}catch(e){say(e.message)}});
document.querySelector('#delete').addEventListener('click',async()=>{if(!confirm('Delete this configuration?'))return;try{
 await api('/api/ops/admin/delete','POST',{kind:kind.value,id:document.querySelector('#record-id').value,expectedVersion:Number(document.querySelector('#version').value)});
 await refreshItems();await refreshAudit();say('Configuration deleted');
}catch(e){say(e.message)}});
refresh().catch(e=>say(e.message));