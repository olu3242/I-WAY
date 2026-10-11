const form=document.querySelector('#login'),message=document.querySelector('#message');
form.addEventListener('input',event=>{event.target.removeAttribute('aria-invalid');});
form.addEventListener('submit',async event=>{
 event.preventDefault();const button=form.querySelector('button');button.disabled=true;message.textContent='';message.role='status';message.ariaLive='polite';
 for(const input of form.querySelectorAll('input')){input.removeAttribute('aria-invalid');input.removeAttribute('aria-describedby');}
 try{
  const response=await fetch('/api/ops/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))});
  const data=await response.json();if(!response.ok)throw new Error(data.error);form.reset();location.assign('/app');
 }catch(error){
  message.role='alert';message.ariaLive='assertive';message.className='error-message';message.textContent=error.message||'Sign-in unavailable.';
  for(const input of form.querySelectorAll('input')){input.setAttribute('aria-invalid','true');input.setAttribute('aria-describedby','message');}
  message.focus();
 }finally{button.disabled=false;}
});
