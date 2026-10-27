// Feedback deliberately accepts structured metadata, never uploads or raw diagnostics.
(()=>{
 const root=document.querySelector('#uat-feedback');if(!root)return;
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const human=value=>String(value).replaceAll('_',' '),keys=new Map();let data,actor,busy=false;
 const message=(text,error=false)=>{const notice=root.querySelector('#feedback-notice');notice.setAttribute('role',error?'alert':'status');notice.setAttribute('aria-live',error?'assertive':'polite');notice.textContent=text;};
 async function api(action,payload={},row){
  const session=await fetch('/api/ops/session');if(!session.ok)throw Error('Sign in required.');const identity=await session.json();actor=identity.actor;
  const input={action,payload,...(row?{id:row.id,expectedVersion:row.version}:{})};
  if(action!=='list'){const signature=JSON.stringify(input);if(!keys.has(signature))keys.set(signature,crypto.randomUUID());input.idempotencyKey=keys.get(signature);}
  const response=await fetch('/api/ops/feedback',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':identity.csrf},body:JSON.stringify(input)});
  const result=await response.json();if(!response.ok)throw Error(result.error??'Feedback unavailable.');return result;
 }
 const select=(name,label,values,id=name)=>'<label for="'+id+'">'+label+'</label><select id="'+id+'" name="'+name+'">'+values.map(value=>{const [key,text]=Array.isArray(value)?value:[value,human(value)];return '<option value="'+escape(key)+'">'+escape(text)+'</option>';}).join('')+'</select>';
 function render(){
  root.hidden=!data.enabled;if(!data.enabled){root.innerHTML='';return;}
  const c=data.contract;
  root.innerHTML='<h2>UAT feedback</h2><p>Report workflow metadata only. Do not include operational data, passwords, tokens, images or bank details. Feedback stays within your authorized workspace.</p><p id="feedback-notice" role="status" aria-live="polite" tabindex="-1"></p>'+
   (data.canSubmit?'<form id="uat-feedback-create"><h3>Report a workflow issue</h3>'+select('workflow','Affected workflow',c.workflows)+select('symptom','Observed symptom',c.symptoms)+select('severity','Impact',c.severities)+select('reproducibility','Reproducibility',c.reproducibility)+'<button type="submit">Submit UAT feedback</button></form>':'')+
   '<button type="button" id="uat-feedback-refresh">Refresh UAT feedback</button>'+
   (data.rows.length?data.rows.map(row=>'<article class="card"><h3>'+escape(human(row.workflow))+' · '+escape(human(row.symptom))+'</h3><p>'+escape(row.persona)+' · '+escape(row.severity)+' · '+escape(human(row.status))+'</p><p>Owner: '+escape(data.owners.find(owner=>owner.id===row.ownerId)?.name??(row.ownerId?'Assigned reviewer':'Awaiting triage'))+'</p>'+
    (data.canTriage&&(c.transitions[row.status]??[]).length?'<form data-feedback-triage="'+row.id+'">'+select('status','Next feedback status',c.transitions[row.status],'feedback-status-'+row.id)+select('ownerId','Feedback owner',data.owners.map(owner=>[owner.id,owner.name]),'feedback-owner-'+row.id)+select('reason','Triage reason',c.reasons,'feedback-reason-'+row.id)+(row.status==='in_progress'?'<label for="feedback-evidence-'+row.id+'">Reviewed commit SHA or run reference</label><input id="feedback-evidence-'+row.id+'" name="evidenceReference" maxlength="68" required>':'')+'<button type="submit">Save feedback triage</button></form>':'')+
    (data.canSubmit&&row.reporterId===actor.id&&row.status==='awaiting_retest'?'<form data-feedback-retest="'+row.id+'">'+select('passed','Retest outcome',[['no','Issue remains'],['yes','Issue resolved']],'feedback-result-'+row.id)+'<label for="feedback-retest-'+row.id+'">Retest run reference</label><input id="feedback-retest-'+row.id+'" name="evidenceReference" maxlength="68" required><button type="submit">Record feedback retest</button></form>':'')+
    '<details><summary>Feedback history</summary><ol>'+data.events.filter(event=>event.feedbackId===row.id).map(event=>'<li>'+escape(event.at)+' · '+escape(human(event.after))+' · '+escape(human(event.reason))+'</li>').join('')+'</ol></details></article>').join(''):'<p>No feedback in your permitted scope.</p>');
 }
 async function load(){
  if(busy)return;busy=true;const controls=[...root.querySelectorAll('input,select,button')].filter(control=>!control.disabled);controls.forEach(control=>control.disabled=true);root.setAttribute('aria-busy','true');
  try{data=await api('list');render();}
  catch{root.hidden=false;root.innerHTML='<h2>UAT feedback unavailable</h2><p id="feedback-notice" role="status" aria-live="polite">Retry to retrieve confirmed feedback.</p><button type="button" id="uat-feedback-refresh">Refresh UAT feedback</button>';}
  finally{controls.forEach(control=>{if(control.isConnected)control.disabled=false;});busy=false;root.setAttribute('aria-busy','false');}
 }
 root.addEventListener('click',event=>{if(event.target.closest('#uat-feedback-refresh')&&!busy)load();});
 root.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;const form=event.target,p=Object.fromEntries(new FormData(form)),controls=[...root.querySelectorAll('input,select,button')];
  busy=true;root.setAttribute('aria-busy','true');controls.forEach(control=>control.disabled=true);message('Saving feedback…');
  try{
   if(form.id==='uat-feedback-create')await api('create',p);
   else if(form.dataset.feedbackTriage)await api('triage',p,data.rows.find(row=>row.id===form.dataset.feedbackTriage));
   else if(form.dataset.feedbackRetest)await api('retest',{...p,passed:p.passed==='yes'},data.rows.find(row=>row.id===form.dataset.feedbackRetest));
   else throw Error('Unsupported feedback form.');
   data=await api('list');render();message('Feedback saved.');
  }catch(error){message(error.message,true);}
  finally{controls.forEach(control=>{if(control.isConnected)control.disabled=false;});busy=false;root.setAttribute('aria-busy','false');root.querySelector('#feedback-notice')?.focus();}
 });
 load();
})();
