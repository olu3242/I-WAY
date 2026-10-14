/** Opt-in QA widget. The server MUST independently authenticate and authorize each request.
 * Do not embed access tokens or store session IDs in localStorage.
 */
export function mountQaPersonaSwitcher({root,api,targets=[]}={}){
 if(!root||!api||!['start','resolve','stop'].every(key=>typeof api[key]==='function'))throw Error('QA_SWITCHER_PORTS_REQUIRED');
 root.replaceChildren();
 const label=document.createElement('label');label.textContent='QA persona';
 const select=document.createElement('select');select.setAttribute('aria-label','QA persona');
 const empty=document.createElement('option');empty.value='';empty.textContent='Choose test persona';select.append(empty);
 for(const target of targets){const option=document.createElement('option');option.value=target.id;option.textContent=target.label;select.append(option)}
 const reason=document.createElement('input');reason.placeholder='Reason for QA session';reason.setAttribute('aria-label','Reason for QA session');
 const start=document.createElement('button');start.type='button';start.textContent='Start QA session';
 const stop=document.createElement('button');stop.type='button';stop.textContent='Exit QA session';stop.hidden=true;
 const banner=document.createElement('p');banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');
 let sessionId=null;
 start.addEventListener('click',async()=>{
  start.disabled=true;
  try{
   const result=await api.start({targetId:select.value,reason:reason.value});
   sessionId=result.sessionId;
   banner.textContent='QA impersonation active. Exit when finished.';
   stop.hidden=false;
  }catch{banner.textContent='Unable to start QA session.'}
  finally{start.disabled=false}
 });
 stop.addEventListener('click',async()=>{
  stop.disabled=true;
  try{await api.stop({sessionId});sessionId=null;banner.textContent='QA session ended.';stop.hidden=true}
  catch{banner.textContent='Unable to end QA session. Contact an administrator.'}
  finally{stop.disabled=false}
 });
 root.append(label,select,reason,start,stop,banner);
 return Object.freeze({get sessionId(){return sessionId}});
}
