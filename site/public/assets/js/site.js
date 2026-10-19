const form=document.querySelector('#ea-form');
if(form){
 const button=form.querySelector('button[type="submit"]');
 const error=document.querySelector('#form-error');
 const errorText=document.querySelector('#form-error-text');
 const success=document.querySelector('#ea-success');
 const successOk=document.querySelector('#ea-success-ok');
 const successPreview=document.querySelector('#ea-success-preview');
 const edit=document.querySelector('#ea-edit');
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!form.reportValidity()||button.disabled)return;
  const fields=new FormData(form);
  const payload={name:String(fields.get('name')||''),email:String(fields.get('email')||''),company:String(fields.get('company')||''),role:String(fields.get('role')||''),consent:fields.get('consent')==='on'};
  if(!payload.consent)return;
  button.disabled=true;
  if(error)error.hidden=true;
  try{
   const response=await fetch(form.action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   if(!response.ok)throw new Error('Registration request failed');
   document.querySelector('#ea-name').textContent=payload.name;
   document.querySelector('#ea-email').textContent=payload.email;
   form.hidden=true;
   if(successPreview)successPreview.hidden=true;
   if(successOk)successOk.hidden=false;
   if(success){success.hidden=false;success.focus();}
  }catch{
   if(errorText)errorText.textContent='Unable to submit. Please try again.';
   if(error)error.hidden=false;
  }finally{button.disabled=false;}
 });
 if(edit)edit.addEventListener('click',()=>{if(success)success.hidden=true;form.hidden=false;form.querySelector('input')?.focus();});
}
