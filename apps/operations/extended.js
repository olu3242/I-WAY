// Private local operational views. Content is escaped; documents never enter public assets.
function extendedTabs(){
 const tabs=[];
 if(can('billing:manage'))tabs.push(['billing','Billing & receivables']);
 if(can('document:review'))tabs.push(['documents','Document review']);
 if(can('analytics:view'))tabs.push(['analytics','Operations analytics']);
 if(can('customer:manage'))tabs.push(['customers','Customers']);
 if(can('notification:preferences'))tabs.push(['notifications','Notifications']);
 if(state.actor.role==='customer')tabs.push(['customer-invoices','Invoices']);
 return tabs;
}
function extendedLoadPanels(load){
 if(!state.documents)return '';
 const documents=state.documents.filter(d=>d.loadId===load.id),pods=state.pods.filter(p=>p.loadId===load.id);
 let html='<section class="card"><h2>Shipping documents</h2>'+documents.map(d=>'<div class="inline-record"><div><strong>'+esc(d.type)+' · Revision '+d.revision+'</strong><p>'+chip(d.status)+' · '+esc(d.extraction.confidence)+' confidence</p><p class="small muted">Local text parser · Human review '+(d.reviewNeeded?'required':'recorded')+'</p><a href="/api/ops/documents/'+encodeURIComponent(d.id)+'" target="_blank" rel="noopener">Read document revision '+d.revision+'</a></div><div class="actions">'+(d.reviewNeeded&&can('document:review')?button('Validate document','document:validate',d.id)+button('Reject document','document:reject',d.id):'')+'</div></div>').join('')+(documents.length?'':'<p>No shipping documents recorded.</p>')+'</section>';
 if(can('document:manage'))html+='<form id="document-ingest" class="card"><h2>Add shipping document</h2><p class="muted">Plain text or JSON only. Extraction uses local field rules; every revision requires human review.</p><div class="grid">'+select('documentType','Document type',[['auto','Classify from content'],['BOL','Bill of lading'],['other','Other document']])+select('mimeType','Content format',[['application/json','JSON fields'],['text/plain','Plain text fields']])+select('previousDocId','Revise existing document',[['','New document'],...documents.map(d=>[d.id,d.type+' revision '+d.revision])])+'<div class="wide"><label for="documentContent">Document text</label><textarea id="documentContent" name="documentContent" maxlength="32768" required></textarea><p class="small muted">BOL fields: loadReference, shipper, consignee, commodity, weightLb, pickupLocation, deliveryLocation.</p></div></div><div class="actions"><button class="primary">Ingest document</button>'+(can('document:review')?button('Check document requirements','document:scan',load.id):'')+'</div></form>';
 if(can('pod:record')&&['in_transit','delivered'].includes(load.status)){
  const pending=load.stops.filter(s=>s.type==='delivery'&&!pods.some(p=>p.stopId===s.id));
  if(pending.length)html+='<form id="pod-record" class="card"><h2>Recipient acknowledgment</h2><p>Record a confirmed acknowledgment and an evidence reference. Do not enter signature images or precise GPS.</p><div class="grid">'+select('stopId','Delivery stop',pending.map(s=>[s.id,s.location]))+field('evidenceReference','Acknowledgment evidence reference')+'<div class="wide"><label class="check-label"><input type="checkbox" name="recipientAcknowledged" required> Recipient has acknowledged receipt</label></div></div><div class="actions"><button>Record acknowledgment</button></div></form>';
 }
 if(pods.length)html+='<section class="card"><h2>Delivery acknowledgments</h2>'+pods.map(p=>'<p>'+esc(p.stopId)+' · Recipient acknowledged · '+esc(date(p.recordedAt))+'</p>').join('')+'</section>';
 return html;
}
function extendedView(name){
 if(name==='billing')return billingView();
 if(name==='documents')return pageHead('Document review','Review extracted shipping fields and resolve document exceptions.')+'<section class="notice">Classification uses deterministic local parsing. PDF/image OCR and model extraction are not configured.</section><section class="card"><h2>Exception queue</h2>'+(state.documentexceptions??[]).filter(e=>e.status==='open').map(e=>'<div class="inline-record"><div><strong>'+esc(state.loads.find(l=>l.id===e.loadId)?.reference)+'</strong><p>'+esc(e.issueCodes.join(', '))+' · '+esc(e.escalation)+'</p></div>'+button('Open shipment','open',e.loadId)+'</div>').join('')+'</section>'+loadTable(state.loads.filter(l=>(state.documents??[]).some(d=>d.loadId===l.id&&d.reviewNeeded)));
 if(name==='notifications')return pageHead('Notifications','Local delivery records; no external messages are sent.')+'<form id="notification-preference" class="card"><h2>Your preferences</h2>'+select('enabled','Shipment notifications',[['yes','Enabled'],['no','Suppressed']],state.notificationpreference?.enabled===false?'no':'yes')+'<div class="actions"><button>Save preferences</button></div></form><section class="card"><h2>Delivery records</h2>'+(state.notifications??[]).map(n=>'<p>'+esc(human(n.template))+' · '+chip(n.status)+'</p>').join('')+'</section>';
 if(name==='analytics')return pageHead('Operations analytics','Calculated from your visible shipments and recorded events.')+'<section class="stats">'+Object.entries(state.analytics??{}).filter(([key,value])=>value&&typeof value==='object'&&'value'in value).map(([key,m])=>'<article class="stat"><p>'+esc(key.replace(/([A-Z])/g,' $1'))+'</p><strong>'+(m.value===null?'—':Number(m.value).toFixed(1))+' '+esc(m.unit)+'</strong><p class="small">'+esc(m.basis)+'</p><p class="small">Based on '+m.denominator+' records.</p></article>').join('')+'</section>';
 if(name==='customers')return pageHead('Customers','Connect customer accounts to authorized shipments.')+'<form id="customer-create" class="card"><h2>Add customer</h2>'+field('name','Customer organization name')+'<div class="actions"><button>Create customer relationship</button></div></form><section class="card">'+(state.customers??[]).map(c=>'<p>'+esc(c.name)+'</p>').join('')+'</section>';
 if(name==='customer-invoices')return pageHead('Your invoices','Invoice status for shipments linked to your customer account.')+'<section class="card">'+state.invoices.map(i=>'<div class="inline-record"><div><strong>'+esc(state.loads.find(l=>l.id===i.loadId)?.reference)+'</strong><p>'+chip(i.status)+' · '+new Intl.NumberFormat('en-US',{style:'currency',currency:i.currency}).format(i.totalCents/100)+'</p></div></div>').join('')+'</section>';
 return null;
}
async function handleExtendedClick(event){
 const b=event.target.closest('[data-action]');if(!b||!['document','billing','payment'].includes(b.dataset.action.split(':')[0]))return false;
 b.disabled=true;try{
  const a=b.dataset.action;
  if(a.startsWith('billing:')||a.startsWith('payment:')){let record=a==='billing:generate'?state.loads.find(l=>l.id===b.dataset.id):a.startsWith('payment:')?state.payments.find(p=>p.id===b.dataset.id):state.invoices.find(i=>i.id===b.dataset.id);let payload={};if(a!=='billing:generate'){const reason=prompt('Reason for this financial record decision');if(!reason)return true;payload={reason};}if(a==='billing:issue'){const dueOn=prompt('Invoice due date (YYYY-MM-DD)');if(!dueOn)return true;payload.dueOn=dueOn;}await command(a,record,payload);}
  else if(a==='document:scan')await command(a,state.loads.find(l=>l.id===b.dataset.id),{});
  else {const d=state.documents.find(d=>d.id===b.dataset.id),reason=prompt('Reason for this document review');if(!reason)return true;await command('document:review',d,{decision:a.endsWith('validate')?'validate':'reject',reason});}
  alertMessage('Decision saved.');
 }catch(e){alertMessage(e.message,true)}finally{b.disabled=false}return true;
}
async function handleExtendedSubmit(event){
 const form=event.target;if(!['document-ingest','pod-record','notification-preference','payment-record','customer-create'].includes(form.id))return false;
 event.preventDefault();const b=form.querySelector('button'),v=Object.fromEntries(new FormData(form));b.disabled=true;
 try{
  const load=state.loads.find(l=>l.id===selected);
  if(form.id==='customer-create')await command('customer:create',null,{name:v.name});
  if(form.id==='payment-record')await command('payment:record',state.invoices.find(i=>i.id===v.invoiceId),{amountCents:Number(v.amountCents),currency:'USD',reference:v.reference,invoiceReference:v.invoiceReference,provenance:v.provenance,receivedAt:new Date(v.receivedAt+'Z').toISOString()});
  if(form.id==='document-ingest')await command('document:ingest',load,{type:v.documentType,mimeType:v.mimeType,content:v.documentContent,...(v.previousDocId?{previousDocId:v.previousDocId}:{})});
  if(form.id==='pod-record')await command('pod:record',load,{stopId:v.stopId,evidenceReference:v.evidenceReference,recipientAcknowledged:v.recipientAcknowledged==='on'});
  if(form.id==='notification-preference')await command('notification:preferences',state.notificationpreference??null,{enabled:v.enabled==='yes',templates:['load_delivered','invoice_issued','document_exception']});
  alertMessage('Saved.');
 }catch(e){alertMessage(e.message,true)}finally{b.disabled=false}return true;
}

function billingView(){
 const invoices=state.invoices??[];
 return pageHead('Billing & receivables','Issue human-approved invoices backed by shipping documents and delivery acknowledgments.')+
 '<section class="notice">Reconciliation uses reported evidence. No bank verification or money movement occurs here.</section>'+
 '<section class="card"><h2>Invoice lifecycle</h2>'+state.loads.filter(l=>l.status==='delivered').map(l=>{const i=invoices.find(i=>i.loadId===l.id);return '<div class="inline-record"><div><strong>'+esc(l.reference)+'</strong><p>'+(i?chip(i.status)+' · '+new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(i.totalCents/100):'No financial record')+'</p>'+(i?.invoiceReference?'<p class="small">'+esc(i.invoiceReference)+'</p>':'')+'</div><div class="actions">'+(!i?button('Generate verified invoice','billing:generate',l.id):i.status==='ready'?button('Approve record','finance:approve',i.id):i.status==='approved'?button('Issue invoice','billing:issue',i.id):'')+(i&&['ready','approved','issued'].includes(i.status)?button('Void invoice','billing:void',i.id):'')+'</div></div>';}).join('')+'</section>'+
 '<form id="payment-record" class="card"><h2>Record receivable evidence</h2><div class="grid">'+select('invoiceId','Outstanding invoice',invoices.filter(i=>['issued','partially_paid'].includes(i.status)).map(i=>[i.id,i.invoiceReference]))+
 field('amountCents','Reported amount (cents, USD)','number','1','min="1" step="1"')+field('reference','Payment evidence reference')+field('invoiceReference','Invoice reference to match')+field('receivedAt','Reported receipt time (UTC)','datetime-local',new Date().toISOString().slice(0,16))+select('provenance','Evidence source',[['user_reported','User-reported evidence'],['local_fixture','Illustrative test fixture']])+'</div><div class="actions"><button>Record evidence</button></div></form>'+
 '<section class="card"><h2>Reconciliation queue</h2>'+(state.payments??[]).map(p=>'<div class="inline-record"><div><strong>'+esc(p.referenceHint)+'</strong><p>'+chip(p.status)+' · '+p.amountCents+' cents · '+esc(p.provenance)+'</p><p>'+esc(p.discrepancies.join(', '))+'</p></div><div class="actions">'+(p.status==='reported'?button('Reconcile evidence','payment:reconcile',p.id)+button('Reject evidence','payment:reject',p.id):'')+'</div></div>').join('')+'</section>';
}
