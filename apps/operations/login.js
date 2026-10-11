const form=document.querySelector('#login'),message=document.querySelector('#message');
form.addEventListener('submit',async event=>{event.preventDefault();const button=form.querySelector('button');button.disabled=true;message.textContent='';
 try{const response=await fetch('/api/ops/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))});const data=await response.json();if(!response.ok)throw new Error(data.error);form.reset();location.assign('/app');}
 catch(error){message.textContent=error.message||'Sign-in unavailable.';}finally{button.disabled=false;}
});