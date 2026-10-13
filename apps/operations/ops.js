let state,tab='overview',selected=null,creating=false;
// B19: browser connectivity is advisory; server authorization is always required.
let driverNetworkOnline=typeof navigator==='undefined'?true:navigator.onLine;
if(typeof window!=='undefined')window.addEventListener('online',()=>{driverNetworkOnline=true;if(state)render();});
if(typeof window!=='undefined')window.addEventListener('offline',()=>{driverNetworkOnline=false;if(state)render();});
const view=document.querySelector('#view'),message=document.querySelector('#message');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const human=value=>String(value??'').replaceAll('_',' ').replaceAll(':',' · ');
const date=value=>value?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short',timeZone:state.tenant.timezone}).format(new Date(value)):'Not scheduled';
const chip=value=>'<span class="chip '+(['delivered','approved','ready','completed','resolved'].includes(value)?'done':['draft','pending','assigned','open','waiting_approval','retry'].includes(value)?'warn':['void','critical','failed','out_of_service','rejected','expired'].includes(value)?'error':'')+'">'+esc(human(value))+'</span>';
const field=(name,label,type='text',value='',extra='')=>'<div><label for="'+name+'">'+esc(label)+'</label><input id="'+name+'" name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+extra+' required></div>';
const select=(name,label,rows,selected='')=>'<div><label for="'+name+'">'+esc(label)+'</label><select id="'+name+'" name="'+name+'" '+(rows.some(([value])=>value==='')?'':'required')+'>'+rows.map(([value,label])=>'<option value="'+esc(value)+'" '+(value===selected?'selected':'')+'>'+esc(label)+'</option>').join('')+'</select></div>';
const can=action=>state.actor.permissions.includes(action);
const button=(label,action,id,extra='')=>'<button type="button" data-action="'+action+'" data-id="'+esc(id)+'" '+extra+'>'+esc(label)+'</button>';
const pageHead=(title,description,action='')=>'<div class="page-head"><div><p class="eyebrow">'+esc(human(state.actor.role))+' WORKSPACE</p><h1>'+esc(title)+'</h1><p class="muted">'+esc(description)+'</p></div>'+action+'</div>';
function alertMessage(text,error=false){message.className=error?'error-message':'success-message';message.role=error?'alert':'status';message.ariaLive=error?'assertive':'polite';message.ariaAtomic='true';message.tabIndex=-1;message.textContent=text;message.focus?.({preventScroll:true});message.scrollIntoView({block:'nearest'});}
function showView(){message.textContent='';message.className='';message.role='status';message.ariaLive='polite';render();const heading=view.querySelector('h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});heading.scrollIntoView({block:'nearest'});}}
async function request(path,options={}){
 const response=await fetch(path,{...options,headers:{'Content-Type':'application/json','X-CSRF-Token':state?.csrf??'',...options.headers}});
 const data=await response.json();if(response.status===401){location.assign('/login');throw new Error('Sign in required.');}if(!response.ok)throw new Error(data.error??'Request failed.');return data;
}
async function refresh(){state=await request('/api/ops/state');render();}
const pendingCommands=new Map();
async function command(action,record,payload={}){
 const signature=JSON.stringify({action,id:record?.id,version:record?.version,payload});
 if(!pendingCommands.has(signature))pendingCommands.set(signature,crypto.randomUUID());
 const result=await request('/api/ops/commands',{method:'POST',body:JSON.stringify({action,resourceId:record?.id,expectedVersion:record?.version,payload,idempotencyKey:pendingCommands.get(signature)})});
 await refresh();pendingCommands.delete(signature);return result;
}
function loadTable(loads=state.loads){
 if(!loads.length)return '<p class="empty">No loads here yet. Your next move starts with a load.</p>';
 return '<div class="table-wrap" tabindex="0" role="region" aria-label="Scrollable records"><table><thead><tr><th>Load</th><th>Route</th><th>Status</th><th>Pickup</th><th></th></tr></thead><tbody>'+loads.map(load=>'<tr><td><strong>'+esc(load.reference)+'</strong><br><span class="muted">'+esc(load.commodity)+'</span></td><td>'+esc(load.stops[0].location)+' → '+esc(load.stops.at(-1).location)+'</td><td>'+chip(load.lifecycleState??load.status)+'</td><td>'+esc(date(load.stops[0].at))+'</td><td>'+button('Open','open',load.id)+'</td></tr>').join('')+'</tbody></table></div>';
}
function overview(){
 const active=state.loads.filter(l=>!['delivered','void'].includes(l.status));
 return pageHead(state.actor.role==='driver'?'Your next move.':'A clear view of today.','Your loads, people and next actions in '+state.tenant.timezone+'.',can('load:create')?'<button class="primary" data-action="new-load">Create load</button>':'')+
 '<section class="stats" aria-label="Operational totals">'+[['Active loads',active.length],['Awaiting assignment',active.filter(l=>['draft','validated'].includes(l.status)).length],['Open exceptions',state.exceptions.filter(e=>e.status==='open').length],['Delivered',state.loads.filter(l=>l.status==='delivered').length]].map(([label,n])=>'<article class="stat"><p>'+label+'</p><strong>'+n+'</strong></article>').join('')+'</section><section class="card"><h2>'+ (state.actor.role==='driver'?'Your assignments':'Active operations')+'</h2>'+loadTable(active)+'</section>';
}
function createLoad(){
 const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,16),later=new Date(Date.now()+2*86400000).toISOString().slice(0,16);
 return pageHead('Create a load','Commercial details stay within the carrier workspace.',button('Back to loads','back'))+
 '<form id="create-load" class="card"><div class="grid">'+field('reference','Load reference')+field('customer','Customer / broker')+
 (can('customer:manage')?select('customerId','Customer portal access',[['','No linked portal'],...(state.customers??[]).map(c=>[c.id,c.name])]):'')+
 select('dispatcherId','Responsible dispatcher',state.users.filter(u=>u.role==='dispatcher'&&u.active).map(u=>[u.id,u.name]))+
 field('commodity','Commodity')+field('weightLb','Weight (lb)','number','1000','min="1" max="200000" step="1"')+
 field('rateCents','Base charge (cents, USD)','number','0','min="0" step="1"')+'<div><label for="chargeLabel">Additional charge label (optional)</label><input name="chargeLabel" id="chargeLabel" maxlength="80"></div><div><label for="chargeCents">Additional charge (cents, USD)</label><input name="chargeCents" id="chargeCents" type="number" min="0" step="1" value="0"></div>'+field('pickup','Pickup location')+field('pickupAt','Pickup time (UTC)','datetime-local',tomorrow)+field('delivery','Delivery location')+field('deliveryAt','Delivery time (UTC)','datetime-local',later)+
 select('factored','Bill to',[['no','Customer / broker'],['yes','Factoring company']])+
 '<div><label for="factorName">Factoring company (when selected)</label><input id="factorName" name="factorName"></div></div><div class="actions"><button class="primary" type="submit">Create draft load</button></div></form>';
}
function loadDetail(){
 const load=state.loads.find(l=>l.id===selected);if(!load){selected=null;return overview();}
 const people=state.drivers.find(d=>d.id===load.driverId),vehicle=state.vehicles.find(v=>v.id===load.vehicleId);
 let actions='';
 if(can('load:dispatch')&&load.status==='validated'&&!load.readyAt)actions+=button('Mark ready','load:ready',load.id);
 if(can('load:dispatch')&&['assigned','accepted'].includes(load.status))actions+=button('Cancel assignment','load:unassign',load.id);
 if(can('load:dispatch')&&load.status==='delivered'&&!load.closedAt)actions+=button('Close delivery','load:close',load.id);
 if(can('load:validate')&&load.status==='draft')actions+=button('Validate load','load:validate',load.id);
 if(can('load:execute')){
  const next=load.stops.find(s=>!s.completedAt);
  if(load.status==='assigned')actions+=button('Accept assignment','load:accept',load.id,'class="primary"');
  if(load.status==='accepted')actions+=button('Complete pickup','load:pickup',load.id,'data-stop="'+esc(next?.id)+'" class="primary"');
  if(load.status==='picked_up')actions+=button('Start transit','load:transit',load.id,'class="primary"');
  if(load.status==='in_transit')actions+='<form id="deliver" class="grid">'+field('proofReference','Delivery proof reference')+'<div class="actions"><button class="primary">Confirm delivery</button></div></form>';
 }
 if(can('load:dispatch')&&['draft','validated','assigned','accepted'].includes(load.status))actions+=button('Void load','load:void',load.id);
 let assignment='';
 if(can('load:dispatch')&&['validated','assigned','accepted'].includes(load.status)){
  assignment='<form id="assign" class="card"><h2>Assign driver and vehicle</h2><p class="muted">Availability, ownership and carrier approval are checked when you assign.</p><div class="grid">'+
   select('driverId','Driver',state.drivers.filter(d=>d.active).map(d=>[d.id,d.name+' · '+(d.approved?'Approved':'Approval needed')]))+
   select('vehicleId','Vehicle',state.vehicles.filter(v=>v.active).map(v=>[v.id,v.name+' · '+human(v.maintenance)]))+
   field('assignmentReason','Assignment reason')+'</div><div class="actions"><button class="primary">Save assignment</button></div></form>';
 }
 return pageHead(load.reference,'Load detail · '+human(load.lifecycleState??load.status),button('All loads','back'))+
 '<div class="split"><section class="card"><h2>Route & milestones</h2>'+load.stops.map(s=>'<div class="detail-line"><span class="stop-dot"></span><div><strong>'+esc(s.location)+'</strong><p>'+esc(human(s.type))+' · '+esc(date(s.at))+'</p><p class="muted small">'+(s.completedAt?'Completed '+esc(date(s.completedAt)):'Awaiting completion')+'</p></div></div>').join('')+
 '<div class="actions">'+actions+'</div></section><section class="card"><h2>Assignment</h2><p>'+chip(load.lifecycleState??load.status)+'</p><p><strong>Driver</strong><br>'+esc(people?.name??(load.driverId?'Assigned':'Not assigned'))+'</p><p><strong>Vehicle</strong><br>'+esc(vehicle?.name??'Not assigned')+'</p><p><strong>Cargo</strong><br>'+esc(load.commodity)+' · '+load.weightLb.toLocaleString()+' lb</p>'+
 (load.rateCents!==undefined?'<p><strong>Base charge</strong><br>'+new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(load.rateCents/100)+'</p>':'')+'</section></div>'+assignment+extraLoadPanels(load);
}
function extraLoadPanels(load){
 let html='';
 if(state.capabilities.includes('tracking:record')&&can('tracking:create')&&['accepted','picked_up','in_transit'].includes(load.status))html+='<div class="split"><form id="tracking" class="card"><h2>Record a milestone</h2><div class="grid">'+field('location','Current location')+field('note','Milestone note')+'</div><div class="actions"><button>Record update</button></div></form><form id="exception" class="card"><h2>Report an exception</h2><div class="grid">'+select('type','Type',[['delay','Delay'],['breakdown','Breakdown'],['cargo','Cargo'],['weather','Weather']])+field('reason','What needs attention?')+'</div><div class="actions"><button>Report exception</button></div></form></div>';
 const tracks=state.trackings.filter(t=>t.loadId===load.id).sort((a,b)=>a.at.localeCompare(b.at)),exceptions=state.exceptions.filter(e=>e.loadId===load.id);
 if(tracks.length||exceptions.length)html+='<section class="card"><h2>Tracking & exceptions</h2><ul class="timeline">'+tracks.map(t=>'<li>'+esc(t.location)+' · '+esc(t.note)+'<small>'+esc(date(t.at))+'</small></li>').join('')+exceptions.map(e=>'<li>'+chip(e.status)+' '+esc(e.type)+' · '+esc(e.reason)+'</li>').join('')+'</ul></section>';
 return html+(typeof extendedLoadPanels==='function'?extendedLoadPanels(load):'');
}
function assets(){
 const editKind=selected?.startsWith('driver:')?'driver':selected?.startsWith('vehicle:')?'vehicle':null;
 if(editKind){
  const record=state[editKind+'s'].find(r=>r.id===selected.split(':')[1]);if(!record){selected=null;return assets();}
  return pageHead(record.name,'Ownership stays fixed; all updates are audited.',button('Back to assets','back'))+
   '<form id="asset-edit" class="card"><div class="grid">'+select('available','Availability',[['yes','Available'],['no','Unavailable']],record.available?'yes':'no')+select('active','Lifecycle',[['yes','Active'],['no','Inactive']],record.active?'yes':'no')+
   (editKind==='vehicle'?select('maintenance','Maintenance',[['ready','Ready'],['due','Service due'],['out_of_service','Out of service']],record.maintenance):state.actor.role==='carrier'?select('compliance','Compliance',[['valid','Valid'],['critical','Critical non-compliance']],record.compliance)+field('expiresOn','Verified document expiry','date',record.expiresOn||''):'')+
   field('reason','Reason for update')+'</div><div class="actions"><button class="primary">Save changes</button></div></form>'+
   (state.actor.role==='carrier'?'<section class="card"><h2>Carrier operating approval</h2><p>'+chip(record.approved?'approved':'pending')+'</p>'+button(record.approved?'Revoke approval':'Approve for carrier',editKind+':approve',record.id,'data-approved="'+(!record.approved)+'"')+'</section>':'');
 }
 return pageHead('People & equipment','Ownership, eligibility and service status in one place.')+
 '<div class="split"><section class="card"><h2>Drivers</h2>'+state.drivers.map(d=>'<div class="inline-record"><div><strong>'+esc(d.name)+'</strong><p>'+chip(d.approved?'approved':'pending')+' '+chip(d.compliance)+'</p><p class="small muted">Document expiry: '+esc(d.expiresOn||'Not recorded')+'</p></div>'+(can('asset:manage')?button('Manage','edit-driver',d.id):'')+'</div>').join('')+(state.drivers.length?'':'<p class="empty">No drivers available.</p>')+'</section><section class="card"><h2>Vehicles</h2>'+state.vehicles.map(v=>'<div class="inline-record"><div><strong>'+esc(v.name)+'</strong><p>'+chip(v.maintenance)+' '+chip(v.approved?'approved':'pending')+'</p><p class="small muted">'+esc(human(v.ownerType))+' owned · '+v.capacityLb.toLocaleString()+' lb</p></div>'+(can('asset:manage')?button('Manage','edit-vehicle',v.id):'')+'</div>').join('')+'</section></div>'+
 (can('asset:manage')?'<form id="vehicle" class="card"><h2>Add a vehicle</h2><div class="grid">'+field('name','Vehicle name / unit')+field('capacityLb','Capacity (lb)','number','45000','min="1" max="200000"')+
 (state.actor.role==='carrier'?select('fleetId','Owner',[['','Carrier'],...state.fleets.map(f=>[f.id,f.name])]):'')+'</div><div class="actions"><button class="primary">Add vehicle</button></div></form>':'');
}
function people(){
 if(state.actor.role==='fleet')return pageHead('Fleet employment','Manage your fleet drivers. Carrier approval remains a separate dispatch requirement.')+'<section class="card"><h2>Your drivers</h2>'+state.users.map(u=>'<div class="inline-record"><div><strong>'+esc(u.name)+'</strong><p>'+chip(u.active?'active':'inactive')+'</p></div>'+(u.active?button('Deactivate account','user:deactivate',u.id):'')+'</div>').join('')+'</section><form id="fleet-driver" class="card"><h2>Add a fleet driver</h2><div class="grid">'+field('name','Display name')+field('username','Username')+field('password','Initial local password','password','','minlength="12" maxlength="256" autocomplete="new-password"')+'</div><div class="actions"><button class="primary">Create driver account</button></div></form>';
 return pageHead('Workspace access','Accounts and relationships are managed by the carrier.')+
 '<section class="card"><h2>Accounts</h2><div class="table-wrap" tabindex="0" role="region" aria-label="Scrollable records"><table><thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Access</th></tr></thead><tbody>'+state.users.map(u=>'<tr><td>'+esc(u.name)+'</td><td>'+esc(human(u.role))+'</td><td>'+chip(u.active?'active':'inactive')+'</td><td>'+(u.active&&u.id!==state.actor.id?button('Deactivate','user:deactivate',u.id):'—')+'</td></tr>').join('')+'</tbody></table></div></section>'+
 '<div class="split"><form id="user" class="card"><h2>Add a local account</h2><div class="grid">'+field('name','Display name')+field('username','Username')+select('role','Role',[['dispatcher','Dispatcher'],['driver','Driver'],['fleet','Fleet administrator'],['carrier','Carrier manager'],['customer','Customer portal']])+select('fleetId','Fleet relationship',[['','Carrier employee'],...state.fleets.map(f=>[f.id,f.name])])+select('customerId','Customer account relationship',[['','No customer relationship'],...(state.customers??[]).map(c=>[c.id,c.name])])+field('password','Initial local password','password','','minlength="12" maxlength="256" autocomplete="new-password"')+'</div><div class="actions"><button class="primary">Create account</button></div></form><form id="fleet" class="card"><h2>Add a fleet company</h2>'+field('fleetName','Fleet company name')+'<div class="actions"><button>Add fleet</button></div></form></div>';
}
function workflows(){
 return pageHead('Review & recovery','Recommendations stay advisory until a carrier manager approves them.')+
 '<section class="notice"><strong>AI provider not configured.</strong> Current recommendations use explicit eligibility and exception rules. They are not model-generated.</section>'+
 state.workflows.map(w=>{const load=state.loads.find(l=>l.id===w.loadId),approval=state.approvals.find(a=>a.workflowId===w.id&&a.status==='pending'),r=state.recommendations.filter(r=>r.workflowId===w.id).at(-1);return '<article class="card"><h2>'+esc(load?.reference??'Load review')+'</h2><p>'+chip(w.status)+' · Checkpoint: '+esc(human(w.checkpoint))+' · Attempts: '+w.attempts+'</p>'+
 (r?'<p><strong>'+esc(human(r.action))+'</strong></p><p>'+esc(r.explanation)+'</p>':'')+
 (approval?'<p class="muted">Approval expires '+esc(date(approval.expiresAt))+'</p>':'')+
 '<div class="actions">'+(['pending','retry','approved'].includes(w.status)&&can('workflow:run')?button('Advance workflow','workflow:advance',w.id):'')+
 (['failed','completed'].includes(w.status)&&state.exceptions.some(e=>e.id===w.exceptionId&&e.status==='open')&&can('workflow:run')?button('Restart review','workflow:restart',w.id):'')+
 (approval&&can('approval:decide')?button('Approve recommendation','approval:approve',approval.id)+button('Reject','approval:reject',approval.id):'')+'</div></article>';}).join('')+(state.workflows.length?'':'<section class="card"><p class="empty">No exception reviews are waiting.</p></section>');
}
function finance(){
 return pageHead('Invoice readiness','Approved commercial terms become auditable records. No payments are sent.')+
 '<section class="card"><h2>Delivered loads</h2>'+state.loads.filter(l=>l.status==='delivered').map(l=>{const invoice=state.invoices.find(i=>i.loadId===l.id);return '<div class="inline-record"><div><strong>'+esc(l.reference)+'</strong><p>'+ (invoice?chip(invoice.status)+' · '+new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(invoice.totalCents/100):'Ready to prepare')+'</p>'+(invoice?'<p class="muted small">Bill to '+esc(invoice.billTo)+' · Pay week '+esc(invoice.payWeek)+'</p>':'')+'</div>'+
 (invoice?invoice.status==='ready'?button('Approve record','finance:approve',invoice.id):'':button('Prepare invoice','finance:prepare',l.id))+'</div>';}).join('')+'</section>';
}
function audit(){
 return pageHead('Activity trail','An append-only record of operational decisions.')+'<section class="card"><div class="table-wrap" tabindex="0" role="region" aria-label="Scrollable records"><table><thead><tr><th>Time</th><th>Action</th><th>Outcome</th><th>Record</th></tr></thead><tbody>'+state.audit.map(a=>'<tr><td>'+esc(date(a.at))+'</td><td>'+esc(human(a.action))+'</td><td>'+chip(a.outcome)+'</td><td>'+esc(a.resourceId?.slice(0,8)??'Workspace')+'</td></tr>').join('')+'</tbody></table></div></section>';
}
// B21: authenticated session identity is verified by the server, never by browser storage.
let offlineSessionSnapshot=null;
async function inspectOfflineSession(){
 const response=await fetch('/api/ops/offline-session',{credentials:'same-origin',cache:'no-store'});
 if(!response.ok){offlineSessionSnapshot=null;throw new Error('Offline session unavailable. Sign in again before continuing.');}
 const data=await response.json();
 if(data.active!==true||data.replayEnabled!==false||data.scope!=='local'||
    data.actorId!==state?.actor?.id||data.tenantId!==state?.actor?.tenantId||
    typeof data.sessionId!=='string'||!/^[a-f0-9]{64}$/.test(data.sessionId)){
  offlineSessionSnapshot=null;throw new Error('Offline session verification failed.');
 }
 if(offlineSessionSnapshot&&offlineSessionSnapshot.sessionId!==data.sessionId){
  offlineSessionSnapshot=null;throw new Error('Session changed. Pending offline work must not be replayed.');
 }
 offlineSessionSnapshot={actorId:data.actorId,tenantId:data.tenantId,sessionId:data.sessionId};
 return offlineSessionSnapshot;
}
function offlineReadiness(){
 return pageHead('Offline readiness','Connectivity does not authorize commands. Driver actions require a confirmed server response.')+
 '<section class="card"><h2>Connection status</h2><p aria-live="polite">'+(driverNetworkOnline?'Browser reports online':'Browser reports offline')+'</p>'+
 '<p>Offline command submission is not yet enabled. Do not rely on this device to record a pickup or transit update while disconnected.</p>'+
 '<p>Reconnect, refresh your assigned loads, and submit the action when the server is available. Unconfirmed actions must be reviewed rather than assumed complete.</p>'+
 '<div class="actions"><button type="button" data-action="offline:refresh">Check server connection</button></div></section>';
}
function render(){
 document.querySelector('#tenant').textContent=state.tenant.name;
 document.querySelector('#identity').textContent=state.actor.name+' · '+human(state.actor.role);
 const tabs=[['overview','Overview'],['loads',state.actor.role==='driver'?'My assignments':'Loads']];
 if(state.actor.role==='driver')tabs.push(['offline','Offline readiness']);
 if(can('asset:view'))tabs.push(['assets','People & equipment']);
 if(typeof extendedTabs==='function')tabs.push(...extendedTabs());
 if(state.capabilities.includes('workflow:advance')&&(can('workflow:run')||can('approval:decide')))tabs.push(['workflows','Review & recovery']);
 if(state.capabilities.includes('finance:prepare')&&can('finance:manage'))tabs.push(['finance','Invoice readiness']);
 if(can('user:manage')||can('employment:manage'))tabs.push(['people','Workspace access']);
 if(can('audit:view'))tabs.push(['audit','Activity']);
 document.querySelector('#nav').innerHTML=tabs.map(([id,label])=>'<button data-tab="'+id+'" aria-current="'+(tab===id?'page':'false')+'">'+label+'</button>').join('');
 const extension=typeof extendedView==='function'?extendedView(tab):null;
 view.innerHTML=extension??(creating?createLoad():tab==='loads'&&selected?loadDetail():tab==='loads'?pageHead('Loads','Manage each move from draft to delivery.',can('load:create')?'<button class="primary" data-action="new-load">Create load</button>':'')+'<section class="card">'+loadTable()+'</section>':tab==='offline'?offlineReadiness():tab==='assets'?assets():tab==='people'?people():tab==='workflows'?workflows():tab==='finance'?finance():tab==='audit'?audit():overview());
}
document.querySelector('#nav').addEventListener('click',event=>{const btn=event.target.closest('[data-tab]');if(btn){tab=btn.dataset.tab;selected=null;creating=false;showView();}});
document.querySelector('#logout').addEventListener('click',async()=>{try{await request('/api/ops/logout',{method:'POST'});location.assign('/login');}catch(error){alertMessage(error.message,true)}});
view.addEventListener('click',async event=>{
 if(typeof handleExtendedClick==='function'&&await handleExtendedClick(event))return;
 const btn=event.target.closest('[data-action]');if(!btn)return;
 const action=btn.dataset.action,id=btn.dataset.id;
 if(action==='offline:refresh'){btn.disabled=true;try{await refresh();if(state.actor.role!=='driver')throw new Error('Driver access required.');await inspectOfflineSession();alertMessage('Driver session verified. Offline command submission remains disabled.');}catch(error){offlineSessionSnapshot=null;alertMessage('Server or driver session unavailable. No action was submitted.',true);}finally{btn.disabled=false;}return;}
 if(action==='open'){tab='loads';selected=id;creating=false;return showView();}
 if(action==='new-load'){tab='loads';creating=true;return showView();}
 if(action==='back'){selected=null;creating=false;return showView();}
 if(action.startsWith('edit-')){selected=action.slice(5)+':'+id;return showView();}
 btn.disabled=true;
 try{
  let record=state.loads.find(l=>l.id===id),payload={};
  if(action==='user:deactivate'){record=state.users.find(u=>u.id===id);const reason=prompt('Reason for deactivating this account');if(!reason)return;payload={reason};}
  if(['load:void','load:unassign','load:close'].includes(action)){const reason=prompt('Reason for '+human(action.split(':')[1]));if(!reason)return;payload={reason};}
  if(action==='load:pickup')payload={stopId:btn.dataset.stop};
  if(action.endsWith(':approve')&&['driver','vehicle'].includes(action.split(':')[0])){record=state[action.split(':')[0]+'s'].find(r=>r.id===id);const reason=prompt('Reason for the carrier approval decision');if(!reason)return;payload={approved:btn.dataset.approved==='true',reason};}
  if(action.startsWith('workflow:'))record=state.workflows.find(w=>w.id===id);
  if(action==='workflow:restart'){const reason=prompt('Reason for requesting a fresh review');if(!reason)return;payload={reason};}
  if(action.startsWith('approval:')){record=state.approvals.find(a=>a.id===id);const reason=prompt('Reason for this decision');if(!reason)return;await command('approval:decide',record,{decision:action.endsWith('approve')?'approved':'rejected',reason});alertMessage('Decision recorded.');return;}
  if(action==='finance:approve'){record=state.invoices.find(i=>i.id===id);const reason=prompt('Reason for approving this financial record');if(!reason)return;payload={reason};}
  await command(action,record,payload);alertMessage('Operation saved.');
 }catch(error){alertMessage(error.message,true);}finally{btn.disabled=false;}
});
view.addEventListener('submit',async event=>{
 event.preventDefault();if(typeof handleExtendedSubmit==='function'&&await handleExtendedSubmit(event))return;
 event.preventDefault();const form=event.target,button=form.querySelector('button[type=submit],button');button.disabled=true;
 const values=Object.fromEntries(new FormData(form)),load=state.loads.find(l=>l.id===selected);
 try{
  if(form.id==='create-load'){const payload={reference:values.reference,customer:values.customer,customerId:values.customerId||null,dispatcherId:values.dispatcherId,commodity:values.commodity,weightLb:Number(values.weightLb),rateCents:Number(values.rateCents),charges:values.chargeLabel.trim()?[{label:values.chargeLabel,amountCents:Number(values.chargeCents)}]:[],factored:values.factored==='yes',factorName:values.factorName,stops:[{type:'pickup',location:values.pickup,at:new Date(values.pickupAt+'Z').toISOString()},{type:'delivery',location:values.delivery,at:new Date(values.deliveryAt+'Z').toISOString()}]};const record=await command('load:create',null,payload);creating=false;selected=record.id;tab='loads';render();}
  if(form.id==='assign')await command('load:assign',load,{driverId:values.driverId,vehicleId:values.vehicleId,reason:values.assignmentReason});
  if(form.id==='deliver')await command('load:deliver',load,{stopId:load.stops.find(s=>!s.completedAt).id,proofReference:values.proofReference});
  if(form.id==='vehicle')await command('vehicle:create',null,{name:values.name,capacityLb:Number(values.capacityLb),fleetId:values.fleetId||null});
  if(form.id==='fleet')await command('fleet:create',null,{name:values.fleetName});
  if(form.id==='fleet-driver'){await command('driver:create',null,values);form.reset();}
  if(form.id==='user'){await command('user:create',null,{...values,fleetId:values.fleetId||null,customerId:values.customerId||null});form.reset();}
  if(form.id==='asset-edit'){const [kind,id]=selected.split(':'),record=state[kind+'s'].find(r=>r.id===id);await command(kind+':update',record,{...values,available:values.available==='yes',active:values.active==='yes'});}
  if(form.id==='tracking')await command('tracking:record',load,values);
  if(form.id==='exception')await command('exception:report',load,values);
  alertMessage('Saved. The workspace is up to date.');
 }catch(error){alertMessage(error.message,true);}finally{button.disabled=false;}
});
refresh().catch(error=>alertMessage(error.message,true));
