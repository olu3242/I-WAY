document.documentElement.classList.add('js');document.documentElement.classList.remove('no-js');
document.querySelectorAll('.reveal').forEach(el=>el.classList.add('in'));
const menu=document.querySelector('.nav-toggle');
menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close menu':'Open menu');document.querySelector('#site-nav')?.setAttribute('data-open',String(open));});
// Registration remains a local preview until a service is explicitly configured.
const form=document.querySelector('#ea-form');
if(form){
 const endpoint=window.IWAY_CONFIG?.earlyAccessEndpoint;
 const preview=document.querySelector('#preview-banner');
 preview.hidden=!!endpoint;
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(!form.reportValidity())return;
  const button=form.querySelector('button[type="submit"]');if(button.disabled)return;
  const values=new FormData(form);button.disabled=true;
  document.querySelector('#form-error').hidden=true;
  try{
   if(endpoint){
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:values.get('name'),email:values.get('email'),company:values.get('company'),role:values.get('role')==='shipper'?'customer':values.get('role'),consent:true})});
    if(!response.ok)throw Error('Registration unavailable');
   }
   document.querySelector('#ea-name').textContent=values.get('name');
   document.querySelector('#ea-email').textContent=values.get('email');
   document.querySelector('#ea-success-ok').hidden=!endpoint;
   document.querySelector('#ea-success-preview').hidden=!!endpoint;
   document.querySelector('#ea-next').hidden=!endpoint;
   form.hidden=true;const success=document.querySelector('#ea-success');success.hidden=false;success.focus();
  }catch{document.querySelector('#form-error').hidden=false;}
  finally{button.disabled=false;}
 });
 document.querySelector('#ea-edit').addEventListener('click',()=>{document.querySelector('#ea-success').hidden=true;form.hidden=false;form.querySelector('input').focus();});
}
