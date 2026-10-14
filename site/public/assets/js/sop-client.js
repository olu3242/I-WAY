// B9: browser-safe SOP client. Never sends tenant, role or actor claims.
export function createSopClient({baseUrl='',getAccessToken,fetchImpl=fetch}={}){
 if(typeof getAccessToken!=='function')throw Error('SOP_TOKEN_PROVIDER_REQUIRED');
 async function send(path,body){
  const token=await getAccessToken();
  if(typeof token!=='string'||!token.trim())throw Error('SOP_AUTH_REQUIRED');
  const response=await fetchImpl(baseUrl+path,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(body)});
  const data=await response.json();
  if(!response.ok)throw Error('SOP_REQUEST_FAILED_'+response.status);
  return data;
 }
 return Object.freeze({
  resolve:message=>send('/api/v1/support/resolve',{message}),
  createTicket:(subject,priority='P3')=>send('/api/v1/support/tickets',{subject,priority}),
  transition:(ticketId,next,note='')=>{
   if(typeof ticketId!=='string'||!/^[A-Za-z0-9_.-]{1,100}$/.test(ticketId))throw Error('SOP_TICKET_ID_INVALID');
   return send('/api/v1/support/tickets/'+ticketId+'/transitions',{next,note});
  }
 });
}
