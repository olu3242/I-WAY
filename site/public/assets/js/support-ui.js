// B15 shared support UI for authenticated application shells.
// The host app must install a trusted token provider; no tokens are persisted.
import {createSopClient} from './sop-client.js';
export function mountSupportUI({documentRef=document,getAccessToken}={}){
 const status=documentRef.getElementById('support-status');
 const panel=documentRef.getElementById('support-panel');
 if(typeof getAccessToken!=='function'){status.textContent='Sign in through your I-way application to use support.';return false}
 const client=createSopClient({getAccessToken});
 panel.hidden=false;status.textContent='Support is available for your signed-in account.';
 const question=documentRef.getElementById('support-question');
 const ticket=documentRef.getElementById('support-ticket');
 question.addEventListener('submit',async event=>{
  event.preventDefault();const output=documentRef.getElementById('guidance');output.textContent='Loading guidance…';
  try{const response=await client.resolve(documentRef.getElementById('question').value);output.textContent=JSON.stringify(response)}
  catch{output.textContent='Guidance is unavailable. Please try again.'}
 });
 ticket.addEventListener('submit',async event=>{
  event.preventDefault();const output=documentRef.getElementById('ticket-result');output.textContent='Submitting…';
  try{const response=await client.createTicket(documentRef.getElementById('subject').value,documentRef.getElementById('priority').value);output.textContent='Ticket created: '+response.ticketId}
  catch{output.textContent='Ticket could not be created. Please try again.'}
 });
 return true;
}
if(typeof document!=='undefined')mountSupportUI({documentRef:document,getAccessToken:globalThis.iwayAuth?.getAccessToken?.bind(globalThis.iwayAuth)});
