let state,tab='overview',selected=null,creating=false,loadSearch='',loadFilter='all';
let journeyLoadId=null,journeyActive=false,progressStale=false;
let workspaceTabs=[],navigationInitialized=false,loadStage='all',assetSearch='',assetStatus='all';
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
 let requestCsrf=state?.csrf??'';
 if(options.method==='POST'){
  const current=await fetch('/api/ops/session');
  if(current.status===401){location.assign('/login');throw new Error('Sign in required.');}
  if(!current.ok)throw new Error('Session verification failed.');
  const identity=await current.json();if(state&&identity.actor.id!==state.actor.id)throw new Error('Session changed. Reload the workspace.');
  requestCsrf=identity.csrf;if(state)state.csrf=requestCsrf;
 }
 const response=await fetch(path,{...options,headers:{'Content-Type':'application/json','X-CSRF-Token':requestCsrf,...options.headers}});
 const data=await response.json();if(response.status===401){location.assign('/login');throw new Error('Sign in required.');}if(!response.ok){const error=new Error(data.error??'Request failed.');error.status=response.status;throw error;}return data;
}
async function refresh(){
 document.querySelector('#main')?.setAttribute?.('aria-busy','true');
 if(!state)message.textContent='Loading your workspace…';
 try{state=await request('/api/ops/state');}
 catch(error){progressStale=true;if(state)render();else view.innerHTML='<section class="card"><h1>Workspace unavailable</h1><p>Your workspace could not load. Retry to retrieve confirmed server data.</p>'+button('Retry workspace','workspace:retry')+'</section>';throw error;}
 finally{document.querySelector('#main')?.setAttribute?.('aria-busy','false');}
 if(!navigationInitialized)message.textContent='';
 progressStale=false;render();document.dispatchEvent(new CustomEvent('iway:workspace',{detail:state}));
}
const pendingCommands=new Map();
async function command(action,record,payload={}){
 const signature=JSON.stringify({action,id:record?.id,version:record?.version,payload});
 if(!pendingCommands.has(signature))pendingCommands.set(signature,crypto.randomUUID());
 if(state.actor.role==='driver'&&['load:accept','load:pickup','load:transit'].includes(action)){
  if(!window.iwayOffline)throw Error('Device queue is starting. Try again.');
  const result=await window.iwayOffline.submit(action,record,payload,pendingCommands.get(signature));
  if(result?.queuedOnDevice)return result;await refresh();pendingCommands.delete(signature);return result;
 }
 let result;try{result=await request('/api/ops/commands',{method:'POST',body:JSON.stringify({action,resourceId:record?.id,expectedVersion:record?.version,payload,idempotencyKey:pendingCommands.get(signature)})});}catch(error){error.commandRejected=error.status>=400&&error.status<500;throw error;}
 await refresh();pendingCommands.delete(signature);return result;
}
function loadTable(loads=state.loads){
 if(!loads.length)return '<p class="empty">No loads here yet. Your next move starts with a load.</p>';
 return '<div class="table-wrap" tabindex="0" role="region" aria-label="Scrollable records"><table><thead><tr><th>Load</th><th>Route</th><th>Status</th><th>Pickup</th><th></th></tr></thead><tbody>'+loads.map(load=>'<tr><td><strong>'+esc(load.reference)+'</strong><br><span class="muted">'+esc(load.commodity)+'</span></td><td>'+esc(load.stops[0].location)+' → '+esc(load.stops.at(-1).location)+'</td><td>'+chip(load.lifecycleState??load.status)+'</td><td>'+esc(date(load.stops[0].at))+'</td><td>'+button('Open','open',load.id)+'</td></tr>').join('')+'</tbody></table></div>';
}
function loadList(){const needle=loadSearch.trim().toLowerCase(),rows=state.loads.filter(l=>(loadFilter==='all'||(loadFilter==='completed'?['delivered','void'].includes(l.status):!['delivered','void'].includes(l.status)))&&(loadStage==='all'||(loadStage==='attention'?state.exceptions.some(e=>e.loadId===l.id&&e.status==='open'):l.status===loadStage))&&[l.reference,l.commodity,...l.stops.map(s=>s.location)].some(v=>String(v).toLowerCase().includes(needle)));return '<section class="card"><form id="load-search"><div class="grid"><div><label for="loadSearch">Search loads</label><input id="loadSearch" name="loadSearch" type="search" maxlength="120" value="'+esc(loadSearch)+'"></div>'+select('loadFilter','Load list',[['all','All loads'],['active','Active loads'],['completed','Completed and voided']],loadFilter)+select('loadStage','Dispatch stage',[['all','All stages'],['draft','Draft'],['validated','Validated / awaiting assignment'],['assigned','Assigned'],['accepted','Accepted'],['picked_up','Picked up'],['in_transit','In transit'],['delivered','Delivered'],['void','Voided'],['attention','Open exception']],loadStage)+'</div><div class="actions"><button>Search loads</button></div></form><p>'+rows.length+' matching loads</p>'+(state.actor.role==='driver'?driverAssignmentCards(rows):loadTable(rows))+'</section>';}
function driverAssignmentCards(loads){return loads.length?'<div class="assignment-grid">'+loads.map(load=>'<article class="assignment-card"><p>'+chip(load.lifecycleState??load.status)+'</p><h2>'+esc(load.reference)+'</h2><ol class="assignment-route"><li><strong>Pickup</strong><p>'+esc(load.stops[0].location)+'</p><p class="small">'+esc(date(load.stops[0].at))+'</p></li><li><strong>Delivery</strong><p>'+esc(load.stops.at(-1).location)+'</p><p class="small">'+esc(date(load.stops.at(-1).at))+'</p></li></ol><p class="muted small">'+esc(load.commodity)+'</p>'+button('Open','open',load.id)+'</article>').join('')+'</div>':'<p class="empty">No assignments match these filters.</p>';}
function workspaceMetrics(){
 const active=state.loads.filter(l=>!['delivered','void'].includes(l.status)),approved=[...(state.settlements??[]),...(state.driverpay??[])].filter(r=>r.status==='approved');
 if(state.actor.role==='fleet')return [['Active fleet loads',active.length],['Available fleet drivers',state.drivers.filter(d=>d.active&&d.available).length],['Vehicles ready for service',state.vehicles.filter(v=>v.active&&v.maintenance==='ready').length],['Approved statements',approved.length]];
 if(state.actor.role==='driver')return [['Active assignments',active.length],['Awaiting your acceptance',active.filter(l=>l.status==='assigned').length],['Open exceptions',state.exceptions.filter(e=>e.status==='open').length],['Approved pay statements',approved.length]];
 return [['Active loads',active.length],['Awaiting assignment',active.filter(l=>['draft','validated'].includes(l.status)).length],['Open exceptions',state.exceptions.filter(e=>e.status==='open').length],['Delivered',state.loads.filter(l=>l.status==='delivered').length]];
}
function workspaceShortcuts(){const links=[['loads','Open loads'],...(can('asset:view')?[['assets','Review people & equipment']]:[]),...(['carrier','fleet','driver'].includes(state.actor.role)?[['expenses','Review expenses']]:[]),...(can('settlement:view')?[['settlements',state.actor.role==='driver'?'Review earnings':'Review settlements']]:[])];return '<nav class="workspace-shortcuts" aria-label="Workflow shortcuts">'+links.map(([id,label])=>'<a href="#'+id+'">'+esc(label)+'<span aria-hidden="true"> →</span></a>').join('')+'</nav>';}
function workspaceNavigation(tabs){
 const groups=[['Work',['overview','loads','first-load','load-wizard']],['People & resources',['assets','people','onboarding','maintenance','directories','customers']],['Finance',['expenses','settlements','driver-pay','billing','finance','customer-invoices']],['Oversight & updates',[]]];
 return groups.map(([name,ids],i)=>{const rows=tabs.filter(([id])=>i===3?!groups.slice(0,3).some(([,known])=>known.includes(id)):ids.includes(id));return rows.length?'<section class="nav-group" aria-labelledby="nav-group-'+i+'"><h2 id="nav-group-'+i+'">'+name+'</h2>'+rows.map(([id,label])=>'<button data-tab="'+id+'" aria-current="'+(tab===id?'page':'false')+'">'+esc(label)+'</button>').join('')+'</section>':'';}).join('');
}
function syncWorkspaceLocation(){if(!state)return;const id=String(globalThis.location?.hash??'').slice(1);if(!/^[a-z-]+$/.test(id)||!workspaceTabs.some(([key])=>key===id))return;tab=id;selected=null;creating=false;showView();}
globalThis.addEventListener?.('hashchange',syncWorkspaceLocation);
function supportsFirstLoad(){return ['carrier','dispatcher','driver'].includes(state.actor.role);}
function firstLoadProgress(load){
 const statuses=['draft','validated','assigned','accepted','picked_up','in_transit','delivered'];
 const step=statuses.indexOf(load?.status);
 const accepted=step>=3&&Boolean(load?.driverId)&&Boolean(load?.vehicleId);
 return {step,accepted};
}
function firstLoadPanel(){
 const load=state.loads.find(l=>l.id===journeyLoadId),{step,accepted}=firstLoadProgress(load);
 const labels=['Workspace access verified','Load created','Load validated','Driver and vehicle assigned','Driver accepted'];
 const complete=[true,step>=0,step>=1,step>=2,accepted];
 const guidance=!load?(state.actor.role==='driver'?'Choose an assigned load to begin.':'Choose an existing load or create one to begin.'):load.status==='void'?'This load is voided. Choose another load to continue.':step===0?'Review the load details, then validate the load.':step===1?'Choose an eligible driver and vehicle and record your assignment reason.':step===2?(state.actor.role==='driver'?'Review the job, then accept the assignment.':'Ask the assigned driver to sign in and accept. Check progress after their response.') :accepted?'Driver acceptance is confirmed.':'Review the current load status before continuing.';
 return '<section class="card first-load-guide" aria-labelledby="first-load-title"><p class="eyebrow">GUIDED DISPATCH</p><h2 id="first-load-title">'+(progressStale?'Progress needs verification':accepted?'Load assigned. Driver accepted.':'Your first accepted load')+'</h2><p>'+esc(progressStale?'Refresh failed. The details below are the last confirmed snapshot. Check progress again before relying on this assignment.':guidance)+'</p>'+
 '<ol class="journey-steps">'+labels.map((label,i)=>'<li'+(!complete[i]&&(i===0||complete[i-1])?' aria-current="step"':'')+'><span class="chip '+(complete[i]?'done':'warn')+'">'+(progressStale?'Last confirmed: ':'')+(complete[i]?'Complete':'Pending')+'</span> '+esc(label)+'</li>').join('')+'</ol>'+
 (load?'<p><strong>'+esc(load.reference)+'</strong> · '+chip(load.lifecycleState??load.status)+'</p>':'')+
 '<p class="muted small">Progress updates when you select Check progress. Queued actions still need confirmation. Complete account setup and carrier approvals before dispatch.</p>'+
 '<div class="actions">'+button('Check progress','journey-refresh')+(load?button('Open guided load','journey-open',load.id):'')+(can('load:create')?button('Create guided load','journey-create'):'')+'</div></section>';
}
function firstLoadView(){
 return pageHead('First load guide','Follow one load from creation to driver acceptance.')+firstLoadPanel()+
 '<form id="journey-select" class="card"><h2>Choose a load</h2>'+select('journeyLoad','Visible load',[['','Choose a load'],...state.loads.map(l=>[l.id,l.reference+' · '+human(l.status)])],journeyLoadId??'')+'<div class="actions"><button>Follow this load</button></div></form>'+
 '<section class="card"><h2>Your daily workflow</h2><p>Use Loads to find a job, open its assignment, and review its recorded milestones. Driver acceptance is the first outcome; pickup and delivery come next.</p></section>';
}
function overview(){
 const active=state.loads.filter(l=>!['delivered','void'].includes(l.status));
 return pageHead(state.actor.role==='driver'?'Your next move.':'A clear view of today.','Your loads, people and next actions in '+state.tenant.timezone+'.',can('load:create')?'<button class="primary" data-action="new-load">Create load</button>':'')+
 (supportsFirstLoad()?'<section class="card"><h2>Get your first load moving</h2><p>Follow a load through validation, assignment and driver acceptance.</p>'+button('Start guided dispatch','journey-start')+'</section>':'')+
 '<section class="stats" aria-label="Operational totals">'+workspaceMetrics().map(([label,n])=>'<article class="stat"><p>'+label+'</p><strong>'+n+'</strong></article>').join('')+'</section>'+workspaceShortcuts()+'<section class="card"><h2>'+ (state.actor.role==='driver'?'Your assignments':state.actor.role==='fleet'?'Fleet operations':'Active operations')+'</h2>'+(state.actor.role==='driver'?driverAssignmentCards(active):loadTable(active))+'</section>';
}
function onWizardLoadSaved(row){if(journeyActive)journeyLoadId=row.id;}
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
  if(load.status==='assigned')actions+=button('Accept assignment','load:accept',load.id,'class="primary"')+button('Reject assignment','load:reject',load.id);
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
 '<ol class="load-phases" aria-label="Recorded shipment stage">'+['draft','validated','assigned','accepted','picked_up','in_transit','delivered'].map(stage=>'<li '+(stage===load.status?'aria-current="step"':'')+'>'+esc(human(stage))+'</li>').join('')+'</ol>'+
 (load.status==='void'?'<p class="notice">This load is voided. No further driver execution is available.</p>':'')+
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
 const needle=assetSearch.trim().toLowerCase(),matches=r=>!needle||String(r.name).toLowerCase().includes(needle);
 const drivers=state.drivers.filter(d=>matches(d)&&(assetStatus==='all'||(assetStatus==='available'?d.active&&d.available:!d.active||!d.approved||d.compliance!=='valid')));
 const vehicles=state.vehicles.filter(v=>matches(v)&&(assetStatus==='all'||(assetStatus==='available'?v.active&&v.available:!v.active||!v.approved||v.maintenance!=='ready')));
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
 '<form id="asset-search" class="card"><div class="grid"><div><label for="assetSearch">Search people & equipment</label><input id="assetSearch" name="assetSearch" type="search" maxlength="120" value="'+esc(assetSearch)+'"></div>'+select('assetStatus','Resource view',[['all','All resources'],['available','Available resources'],['attention','Approval or service attention']],assetStatus)+'</div><div class="actions"><button>Filter resources</button></div><p>Availability does not replace carrier approval or assignment eligibility checks.</p></form>'+
 '<div class="split"><section class="card"><h2>Drivers</h2>'+drivers.map(d=>'<div class="inline-record"><div><strong>'+esc(d.name)+'</strong><p>'+chip(d.approved?'approved':'pending')+' '+chip(d.compliance)+'</p><p class="small muted">'+esc(d.available?'Available':'Unavailable')+' · Document expiry: '+esc(d.expiresOn||'Not recorded')+'</p></div>'+(can('asset:manage')?button('Manage','edit-driver',d.id):'')+'</div>').join('')+(drivers.length?'':'<p class="empty">No drivers match this view.</p>')+'</section><section class="card"><h2>Vehicles</h2>'+vehicles.map(v=>'<div class="inline-record"><div><strong>'+esc(v.name)+'</strong><p>'+chip(v.maintenance)+' '+chip(v.approved?'approved':'pending')+'</p><p class="small muted">'+esc(human(v.ownerType))+' owned · '+v.capacityLb.toLocaleString()+' lb</p></div>'+(can('asset:manage')?button('Manage','edit-vehicle',v.id):'')+'</div>').join('')+(vehicles.length?'':'<p class="empty">No vehicles match this view.</p>')+'</section></div>'+
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
function render(){
 document.body?.setAttribute('data-persona',state.actor.role);
 document.querySelector('#tenant').textContent=state.tenant.name;
 document.querySelector('#identity').textContent=state.actor.name+' · '+human(state.actor.role);
 const tabs=[['overview','Overview'],['loads',state.actor.role==='driver'?'My assignments':'Loads']];
 if(supportsFirstLoad())tabs.push(['first-load','First load guide']);
 if(can('asset:view'))tabs.push(['assets','People & equipment']);
 if(typeof extendedTabs==='function')tabs.push(...extendedTabs());
 if(state.capabilities.includes('workflow:advance')&&(can('workflow:run')||can('approval:decide')))tabs.push(['workflows','Review & recovery']);
 if(state.capabilities.includes('finance:prepare')&&can('finance:manage'))tabs.push(['finance','Invoice readiness']);
 if(can('user:manage')||can('employment:manage'))tabs.push(['people','Workspace access']);
 if(can('audit:view'))tabs.push(['audit','Activity']);
 workspaceTabs=tabs;
 if(!navigationInitialized){const requested=String(globalThis.location?.hash??'').slice(1);if(tabs.some(([id])=>id===requested))tab=requested;navigationInitialized=true;}
 if(!tabs.some(([id])=>id===tab)){tab='overview';selected=null;creating=false;}
 document.querySelector('#nav').innerHTML=workspaceNavigation(tabs);
 const extension=typeof extendedView==='function'?extendedView(tab):null;
 view.innerHTML=tab==='first-load'&&supportsFirstLoad()?firstLoadView():extension??(tab==='loads'&&selected?loadDetail():tab==='loads'?pageHead('Loads','Manage each move from draft to delivery.',can('load:create')?'<button class="primary" data-action="new-load">Create load</button>':'')+loadList():tab==='assets'?assets():tab==='people'?people():tab==='workflows'?workflows():tab==='finance'?finance():tab==='audit'?audit():overview());
 if(progressStale)view.insertAdjacentHTML?.('afterbegin','<section class="notice" aria-label="Stale workspace"><h2>Updates need verification</h2><p>These are the last confirmed records. Retry before relying on their current status.</p>'+button('Retry workspace','workspace:retry')+'</section>');
 if(journeyActive&&supportsFirstLoad()&&tab==='loads'&&!creating&&selected===journeyLoadId)view.querySelector('.page-head')?.insertAdjacentHTML('afterend',firstLoadPanel());
 for(const extra of [...(view.querySelectorAll?.('button.primary')??[])].slice(1))extra.classList.replace('primary','secondary');
}
document.querySelector('#nav').addEventListener('click',event=>{const btn=event.target.closest('[data-tab]');if(btn&&workspaceTabs.some(([id])=>id===btn.dataset.tab)){tab=btn.dataset.tab;selected=null;creating=false;if(globalThis.history?.replaceState)history.replaceState(null,'','#'+tab);showView();}});
document.querySelector('#logout').addEventListener('click',async()=>{try{await window.iwayOffline?.clear();await request('/api/ops/logout',{method:'POST'});location.assign('/login');}catch(error){alertMessage(error.message,true)}});
document.querySelector('#logout').disabled=false;
view.addEventListener('click',async event=>{
 if(event.target.closest('[data-action="workspace:retry"]')){try{await refresh();showView();alertMessage('Workspace updated.');}catch(error){alertMessage(error.message,true);}return;}
 if(typeof handleExtendedClick==='function'&&await handleExtendedClick(event))return;
 const btn=event.target.closest('[data-action]');if(!btn)return;
 const action=btn.dataset.action,id=btn.dataset.id;
 if(action.startsWith('journey-')){
  if(!supportsFirstLoad())return;
  if(action==='journey-refresh'){btn.disabled=true;try{await refresh();alertMessage('Progress updated.');}catch(error){alertMessage(error.message,true);}finally{btn.disabled=false;}return;}
  journeyActive=true;
  if(action==='journey-start'){tab='first-load';creating=false;selected=null;}
  if(action==='journey-open'){tab='loads';selected=journeyLoadId;creating=false;}
  if(action==='journey-create'){wizardStart();return;}
  return showView();
 }
 if(action==='open'){tab='loads';selected=id;creating=false;return showView();}
 if(action==='new-load'){wizardStart();return;}
 if(action==='back'){selected=null;creating=false;if(tab==='load-wizard')tab='loads';return showView();}
 if(action.startsWith('edit-')){selected=action.slice(5)+':'+id;return showView();}
 btn.disabled=true;
 try{
  let record=state.loads.find(l=>l.id===id),payload={};
  if(action==='user:deactivate'){record=state.users.find(u=>u.id===id);const reason=prompt('Reason for deactivating this account');if(!reason)return;payload={reason};}
  if(['load:void','load:unassign','load:close','load:reject'].includes(action)){const reason=prompt('Reason for '+human(action.split(':')[1]));if(!reason)return;payload={reason};}
  if(action==='load:pickup')payload={stopId:btn.dataset.stop};
  if(action.endsWith(':approve')&&['driver','vehicle'].includes(action.split(':')[0])){record=state[action.split(':')[0]+'s'].find(r=>r.id===id);const reason=prompt('Reason for the carrier approval decision');if(!reason)return;payload={approved:btn.dataset.approved==='true',reason};}
  if(action.startsWith('workflow:'))record=state.workflows.find(w=>w.id===id);
  if(action==='workflow:restart'){const reason=prompt('Reason for requesting a fresh review');if(!reason)return;payload={reason};}
  if(action.startsWith('approval:')){record=state.approvals.find(a=>a.id===id);const reason=prompt('Reason for this decision');if(!reason)return;await command('approval:decide',record,{decision:action.endsWith('approve')?'approved':'rejected',reason});alertMessage('Decision recorded.');return;}
  if(action==='finance:approve'){record=state.invoices.find(i=>i.id===id);const reason=prompt('Reason for approving this financial record');if(!reason)return;payload={reason};}
  const result=await command(action,record,payload);alertMessage(result?.queuedOnDevice?'Queued on device. The server has not confirmed this action.':'Operation saved.');
 }catch(error){alertMessage(error.message,true);}finally{btn.disabled=false;}
});
view.addEventListener('submit',async event=>{
 event.preventDefault();
 // Claim expense submissions synchronously before other async delegates can yield.
 // This ensures expenseBusy fences rapid requestSubmit retries of an ambiguous response.
 if((event.target.id==='expense-submit'||event.target.id==='expense-filter')&&typeof expenseSubmit==='function'){
  await expenseSubmit(event);return;
 }
 if(typeof handleExtendedSubmit==='function'&&await handleExtendedSubmit(event))return;
 event.preventDefault();const form=event.target,button=form.querySelector('button[type=submit],button');button.disabled=true;
 const values=Object.fromEntries(new FormData(form)),load=state.loads.find(l=>l.id===selected);
 try{
  if(form.id==='journey-select'){if(!supportsFirstLoad()||!state.loads.some(l=>l.id===values.journeyLoad))throw Error('Choose a visible load.');journeyLoadId=values.journeyLoad;journeyActive=true;render();alertMessage('Following the selected load.');return;}
  if(form.id==='load-search'){loadSearch=values.loadSearch;loadFilter=values.loadFilter;loadStage=values.loadStage;render();alertMessage('Load list filtered.');return;}
  if(form.id==='asset-search'){assetSearch=values.assetSearch;assetStatus=values.assetStatus;render();alertMessage('Resource list filtered.');return;}
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
document.addEventListener('iway:offline-ready',()=>{if(state)document.dispatchEvent(new CustomEvent('iway:workspace',{detail:state}));});
document.addEventListener('iway:offline-confirmed',()=>refresh().catch(error=>alertMessage(error.message,true)));
refresh().catch(error=>alertMessage(error.message,true));
