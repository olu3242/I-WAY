function intelligenceTabs(){
 const tabs=[];
 if(can('intelligence:view'))tabs.push(['tower','Control tower']);
 if(can('orchestration:manage'))tabs.push(['runtime','Workflow runtime']);
 if(can('connector:request'))tabs.push(['integrations','Local adapters']);
 if(can('governance:manage'))tabs.push(['governance','Governance']);
 if(can('cost:manage'))tabs.push(['costs','Cost intelligence']);
 return tabs;
}
function intelligenceLoadPanels(load){
 let html='';
 if(can('intelligence:analyze'))html+='<section class="card"><h2>Shipment analysis</h2><p class="muted">Rules-based estimates and recommendations. No live GPS, routing or AI provider is connected.</p><div class="actions">'+button('Analyze risk','risk:analyze',load.id)+(can('capacity:recommend')&&['validated','assigned','accepted'].includes(load.status)?button('Recommend capacity','capacity:recommend',load.id):'')+(can('orchestration:manage')?button('Start coordinated review','orchestration:request',load.id):'')+'</div></section><form id="route-evaluate" class="card"><h2>Estimate arrival</h2><div class="grid">'+field('distanceMiles','Estimated route miles','number','','min="0.1" max="20000" step="0.1"')+field('averageMph','Assumed average speed (mph)','number','','min="1" max="85" step="0.1"')+field('handlingMinutes','Expected handling (minutes)','number','0','min="0" max="1440" step="1"')+field('departureAt','Planned departure (UTC)','datetime-local',new Date().toISOString().slice(0,16))+select('source','Estimate source',[['user_estimate','User estimate'],['local_fixture','Illustrative fixture']])+'</div><div class="actions"><button>Evaluate arrival estimate</button></div></form>';
 return html;
}
function intelligenceView(name){
 if(name==='tower')return pageHead('Logistics control tower','Visible shipment conditions and human-reviewed recommendations.')+'<section class="notice">Rules-based analysis only. Estimated arrivals and risk indicators are advisory; no model or live telematics provider is connected.</section>'+towerOverview()+'<section class="card"><h2>Shipments</h2>'+loadTable()+'</section><section class="card"><h2>Capacity recommendations</h2>'+(state.capacityProposals??[]).map(p=>'<div class="inline-record"><div><strong>'+esc(state.loads.find(l=>l.id===p.loadId)?.reference)+'</strong><p>'+chip(p.status)+'</p><p>'+esc(p.explanation??p.reason??'Eligibility and available capacity reviewed.')+'</p><p class="small">'+esc(state.drivers.find(d=>d.id===p.driverId)?.name??'No eligible driver')+' · '+esc(state.vehicles.find(v=>v.id===p.vehicleId)?.name??'No eligible vehicle')+'</p></div><div class="actions">'+(p.status==='pending'&&can('capacity:approve')?button('Approve capacity proposal','capacity:approve',p.id)+button('Reject capacity proposal','capacity:reject',p.id):'')+(p.status==='approved'&&can('capacity:apply')?button('Apply approved assignment','capacity:apply',p.id):'')+'</div></div>').join('')+'</section>'+analysisCards();
 if(name==='runtime')return pageHead('Workflow runtime','Durable advisory reviews with bounded tools and recorded checkpoints.')+'<section class="card"><h2>Coordinated reviews</h2>'+runtimeJobs(state.orchestrations??[],'orchestration')+'</section><section class="card"><h2>Agent decisions</h2>'+(state.agentDecisions??[]).map(d=>'<p><strong>'+esc(human(d.role??d.agentRole??'Review'))+'</strong> · '+esc(d.explanation??d.outcome??'Advisory checkpoint recorded')+'</p>'+evidenceStamp(d)).join('')+'</section>';
 if(name==='integrations')return pageHead('Local adapters','Provider-neutral contracts running only against supplied local evidence.')+'<section class="notice">No live provider calls, messages or payment actions. Inputs are validated; URLs and credentials are not accepted.</section><form id="connector-request" class="card"><h2>Run local adapter</h2><div class="grid">'+select('loadId','Shipment',state.loads.map(l=>[l.id,l.reference]))+select('capability','Capability',[['mapping','Route estimate'],['telematics','Reported progress'],['communications','Local notification record'],['accounting','Invoice summary'],['logistics','Reported milestone']])+'<div class="wide"><label for="adapterInput">Local evidence (JSON)</label><textarea name="adapterInput" id="adapterInput" required></textarea><details><summary>Input examples and provenance</summary><p>Mapping: source=user_estimate, distanceMiles, averageMph, handlingMinutes, departureAt (UTC). Telematics: source=user_reported, observedAt (UTC), progressPercent. Communications: source=local_fixture, template=shipment_status, recipientId. Accounting: source=local_fixture, invoiceId. Logistics: source=user_reported, event=delay, occurredAt (UTC).</p></details></div></div><div class="actions"><button>Queue local adapter</button></div></form><section class="card"><h2>Adapter jobs</h2>'+runtimeJobs(state.connectorJobs??[],'connector')+'</section>';
 if(name==='governance')return pageHead('Governance','Human oversight and bounded advisory authority.')+'<section class="notice">Agents cannot assign drivers, approve invoices, reconcile payments or decide human approvals. Every consequential operation remains an authorized human command.</section><form id="governance-update" class="card"><h2>Advisory policy</h2>'+select('enabled','Runtime policy',[['yes','Enabled'],['no','Paused']],state.governancePolicy?.enabled===false?'no':'yes')+'<div><label for="disabledTools">Disabled advisory tools (comma separated)</label><input id="disabledTools" name="disabledTools" value="'+esc((state.governancePolicy?.disabledTools??[]).join(','))+'"></div>'+field('reason','Policy change reason')+'<p class="small">Allowed tool IDs: dispatch:summary, tracking:summary, documents:summary, exceptions:summary, finance:readiness, connector:mapping, connector:telematics, connector:communications, connector:accounting, connector:logistics.</p><div class="actions"><button>Save advisory policy</button></div></form>';
 if(name==='costs')return pageHead('Operational cost intelligence','User-recorded costs and estimates are kept separate. Savings are unmeasured.')+'<form id="cost-record" class="card"><h2>Record cost evidence</h2><div class="grid">'+select('loadId','Shipment',state.loads.map(l=>[l.id,l.reference]))+select('category','Category',[['fuel','Fuel'],['labor','Labor'],['exception','Exception'],['other','Other']])+field('amountCents','Cost (cents, USD)','number','0','min="0" step="1"')+select('basis','Basis',[['recorded','User-recorded cost'],['estimate','Estimate']])+field('reference','Cost evidence reference')+'</div><div class="actions"><button>Record cost</button></div></form><section class="card"><h2>Cost evidence</h2><div id="cost-summary">'+summaryCards(state.costSummary)+'</div></section>';
 return null;
}
function summaryCards(value){
 if(!value)return '<p>No measured records.</p>';
 if(Array.isArray(value))return value.map(v=>summaryCards(v)).join('');
 if(typeof value!=='object')return '<p>'+esc(value)+'</p>';
 return Object.entries(value).filter(([k])=>!['tenantId','evidence','loadId','recordIds'].includes(k)).map(([k,v])=>'<div class="detail-line"><strong>'+esc(k.replace(/([A-Z])/g,' $1'))+'</strong><div>'+(v===null?'Unmeasured':typeof v==='object'?summaryCards(v):esc(v))+'</div></div>').join('');
}
function analysisCards(){
 return '<section class="card"><h2>Arrival estimates</h2>'+(state.routes??[]).map(r=>'<div class="inline-record"><div><strong>'+esc(state.loads.find(l=>l.id===r.loadId)?.reference)+'</strong>'+evidenceStamp(r)+summaryCards(r.summary??{source:r.source,estimatedArrivalAt:r.estimatedArrivalAt??r.eta,explanation:r.explanation})+'</div></div>').join('')+'</section><section class="card"><h2>Shipment risk evidence</h2>'+(state.risks??[]).map(r=>'<div class="inline-record"><div><strong>'+esc(state.loads.find(l=>l.id===r.loadId)?.reference)+'</strong>'+evidenceStamp(r)+'<p>'+esc(r.escalation??r.status??'Reviewed')+' · '+esc(r.explanation??'Rules evaluated')+'</p>'+summaryCards(r.rules??[])+'</div></div>').join('')+'</section>';
}
function runtimeJobs(jobs,kind){
 return jobs.map(j=>'<div class="inline-record"><div><strong>'+esc(state.loads.find(l=>l.id===j.loadId)?.reference??'Shipment review')+'</strong><p>'+chip(j.status)+' · Checkpoint '+esc(j.checkpoint??0)+' · Attempts '+(j.attempts??0)+'</p>'+evidenceStamp(j)+'<p class="small">'+esc(j.lastError??j.capability??'Fixed advisory role sequence')+'</p></div><div class="actions">'+(['dead_letter','blocked'].includes(j.status)?button('Retry review',kind+':retry',j.id):'')+(!['completed','cancelled'].includes(j.status)?button('Cancel review',kind+':cancel',j.id):'')+'</div></div>').join('')||'<p>No pending work.</p>';
}
async function handleIntelligenceClick(event){
 const b=event.target.closest('[data-action]');if(!b||!['risk','capacity','orchestration','connector'].includes(b.dataset.action.split(':')[0]))return false;
 event.preventDefault();b.disabled=true;
 try{
  let action=b.dataset.action,record=state.loads.find(l=>l.id===b.dataset.id),payload={};
  if(['capacity:approve','capacity:reject','capacity:apply'].includes(action)){
   record=state.capacityProposals.find(p=>p.id===b.dataset.id);const reason=prompt('Reason for this capacity decision');if(!reason)return true;
   payload={reason};if(action!=='capacity:apply'){payload.decision=action==='capacity:approve'?'approved':'rejected';action='capacity:decide';}
  }else if(action.endsWith(':retry')||action.endsWith(':cancel')){
   record=(action.startsWith('connector:')?state.connectorJobs:state.orchestrations).find(j=>j.id===b.dataset.id);const reason=prompt('Reason for this workflow action');if(!reason)return true;payload={reason};
  }
  await command(action,record,payload);alertMessage('Advisory action recorded.');
 }catch(e){alertMessage(e.message,true)}finally{b.disabled=false}return true;
}
async function handleIntelligenceSubmit(event){
 const form=event.target;if(!['route-evaluate','cost-record','connector-request','governance-update'].includes(form.id))return false;
 event.preventDefault();const b=form.querySelector('button'),v=Object.fromEntries(new FormData(form));b.disabled=true;
 try{
  if(form.id==='route-evaluate')await command('route:evaluate',state.loads.find(l=>l.id===selected),{distanceMiles:Number(v.distanceMiles),averageMph:Number(v.averageMph),handlingMinutes:Number(v.handlingMinutes),departureAt:new Date(v.departureAt+'Z').toISOString(),source:v.source});
  if(form.id==='cost-record')await command('cost:record',state.loads.find(l=>l.id===v.loadId),{category:v.category,amountCents:Number(v.amountCents),basis:v.basis,reference:v.reference});
  if(form.id==='connector-request')await command('connector:request',state.loads.find(l=>l.id===v.loadId),{capability:v.capability,input:JSON.parse(v.adapterInput)});
  if(form.id==='governance-update')await command('governance:update',state.governancePolicy??null,{enabled:v.enabled==='yes',disabledTools:v.disabledTools.split(',').map(t=>t.trim()).filter(Boolean),reason:v.reason});
  alertMessage('Saved.');
 }catch(e){alertMessage(e.message,true)}finally{b.disabled=false}return true;
}

function towerOverview(){
 const tower=state.controlTower;if(!tower)return '';
 return '<section class="stats">'+[['Visible shipments',tower.shipmentCount],['Active moves',tower.activeShipmentCount],['Open exceptions',tower.openExceptionCount],['Pending approvals',tower.pendingApprovalCount]].map(([label,value])=>'<article class="stat"><p>'+esc(label)+'</p><strong>'+value+'</strong></article>').join('')+'</section><div class="split"><section class="card"><h2>Assigned people & equipment</h2>'+tower.drivers.map(d=>'<p>'+esc(state.drivers.find(x=>x.id===d.id)?.name??'Assigned driver')+' · '+chip(d.compliance)+' · '+(d.approved?'Carrier-approved':'Approval required')+'</p>').join('')+tower.vehicles.map(v=>'<p>'+esc(state.vehicles.find(x=>x.id===v.id)?.name??'Assigned vehicle')+' · '+chip(v.maintenance)+'</p>').join('')+'</section><section class="card"><h2>Actions needing attention</h2>'+tower.actions.map(a=>'<div class="inline-record"><span>'+esc(human(a.action))+'</span>'+button('Open shipment','open',a.loadId)+'</div>').join('')+'</section></div>';
}

function evidenceStamp(record){
 const load=state.loads.find(l=>l.id===record.loadId),stale=load&&load.version!==record.loadVersion;
 return '<p class="small">Recorded '+esc(record.createdAt??'time unavailable')+' · Shipment version '+esc(record.loadVersion??'unavailable')+(record.runNumber?' · Run '+esc(record.runNumber):'')+'</p>'+(stale?'<p class="notice">Shipment changed since this evidence was recorded; rerun the analysis or review before relying on it.</p>':'');
}
