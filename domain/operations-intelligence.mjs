import {authorize} from './authorization.mjs';
import {fields,text,requireValue,integer,utc} from './operations-errors.mjs';

const provenance={source:'deterministic_rules',provider:'none',model:null,ruleVersion:'iway-local-intelligence-v1'};
const dispatchable=['validated','assigned','accepted'];
function human(actor){requireValue(['carrier','dispatcher'].includes(actor.role),'HUMAN_REQUIRED','A permitted human operator must perform this action.',403);}
function finite(value,min,max,label){requireValue(typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max,'ROUTE_INPUT',label+' is outside its supported range.');return value}
function latest(ops,actor,kind,loadId){return ops.store.list(kind,actor.tenantId).filter(record=>record.loadId===loadId).at(-1)}
function proposalLoad(ops,actor,proposal,permission){return ops.read('load',proposal.loadId,actor,permission)}
function validProposal(ops,actor,proposal,load){
 requireValue(proposal.expiresAt>ops.now().toISOString(),'CAPACITY_EXPIRED','This proposal expired; request a new recommendation.',409);
 requireValue(proposal.loadVersion===load.version,'CAPACITY_STALE','Shipment changed; request a new recommendation.',409);
 const driver=ops.read('driver',proposal.driverId,actor),vehicle=ops.read('vehicle',proposal.vehicleId,actor);
 requireValue(driver.version===proposal.driverVersion&&vehicle.version===proposal.vehicleVersion,'CAPACITY_STALE','Eligibility evidence changed; request a new recommendation.',409);
 const eligible=ops.eligibility(actor,driver.id,vehicle.id,load,load.id);
 requireValue(eligible.eligible,'CAPACITY_INELIGIBLE','Proposed capacity is no longer eligible.',409);
 requireValue(dispatchable.includes(load.status),'CAPACITY_STATE','Assignment cannot change in this shipment state.',409);
 return eligible;
}
function authorizedReviewer(ops,actor,proposal,load){
 const reviewer=ops.store.principal(proposal.decidedBy);
 requireValue(reviewer?.active&&reviewer.tenantId===actor.tenantId&&reviewer.role==='carrier'&&authorize({actor:reviewer,action:'capacity:approve',resource:load})&&authorize({actor:reviewer,action:'load:dispatch',resource:load}),'APPROVAL_AUTHORITY','The reviewer no longer has approval authority; request a new review.',403);
}
function costView(ops,actor,loads,routes){
 if(actor.role!=='carrier'||!actor.permissions.includes('cost:manage'))return null;
 const loadIds=new Set(loads.map(load=>load.id)),costs=ops.store.list('operationcost',actor.tenantId).filter(cost=>loadIds.has(cost.loadId));
 const sum=entries=>entries.reduce((total,cost)=>{const value=total+cost.amountCents;requireValue(Number.isSafeInteger(value),'COST_TOTAL','Recorded totals exceed the supported integer range.');return value},0);
 const perLoad=loads.map(load=>{
  const entries=costs.filter(cost=>cost.loadId===load.id),recorded=entries.filter(cost=>cost.basis==='recorded'),estimated=entries.filter(cost=>cost.basis==='estimate');
  const route=routes.filter(route=>route.loadId===load.id).at(-1),recordedCents=sum(recorded),estimatedCents=sum(estimated);
  return {loadId:load.id,recordedCents,estimatedCents,recordedEntries:recorded.length,estimatedEntries:estimated.length,
   exceptionRecordedCents:sum(recorded.filter(cost=>cost.category==='exception')),exceptionEstimatedCents:sum(estimated.filter(cost=>cost.category==='exception')),
   evidenceIds:entries.map(cost=>cost.id),costPerEstimatedMileCents:route&&recorded.length?Math.round(recordedCents/route.distanceMiles):null,
   distanceEstimateId:route?.id??null,distanceSource:route?.source??null,routeEfficiency:null,savingsCents:null};
 });
 const recordedCents=sum(costs.filter(cost=>cost.basis==='recorded')),estimatedCents=sum(costs.filter(cost=>cost.basis==='estimate')),measuredLoads=perLoad.filter(load=>load.recordedEntries>0).length;
 return {currency:'USD',recordedCents,estimatedCents,loadsWithRecordedCosts:measuredLoads,loadsWithoutRecordedCosts:loads.length-measuredLoads,
  recordedCostPerLoadCents:measuredLoads?Math.round(recordedCents/measuredLoads):null,perLoad,costs,savingsCents:null,routeEfficiency:null,
  note:'Recorded entries and user estimates are separate. Missing entries do not establish zero costs. Distance-based ratios use estimates; no measured route efficiency or savings are available.'};
}
export function intelligenceState(ops,actor,visibleLoads){
 actor=ops.actor(actor.id);
 if(!['carrier','dispatcher'].includes(actor.role)||!actor.permissions.includes('intelligence:view'))return {controlTower:null,routes:[],risks:[],capacityProposals:[],costSummary:null};
 const loads=visibleLoads.flatMap(record=>{try{const load=ops.read('load',record.id,actor);return authorize({actor,action:'intelligence:view',resource:load})&&authorize({actor,action:'load:view',resource:load})?[load]:[]}catch{return []}});
 const ids=new Set(loads.map(load=>load.id)),scoped=kind=>ops.store.list(kind,actor.tenantId).filter(record=>ids.has(record.loadId));
 const routes=scoped('routeevaluation'),risks=scoped('risk'),capacityProposals=scoped('capacityproposal');
 const operational=scoped('exception').filter(item=>item.status==='open'),documents=scoped('documentexception').filter(item=>item.status==='open');
 const approvals=scoped('approval').filter(item=>item.status==='pending'),pendingCapacity=capacityProposals.filter(item=>item.status==='pending'&&item.expiresAt>ops.now().toISOString());
 const driverIds=new Set(loads.map(load=>load.driverId).filter(Boolean)),vehicleIds=new Set(loads.map(load=>load.vehicleId).filter(Boolean));
 const drivers=ops.store.list('driver',actor.tenantId).filter(item=>driverIds.has(item.id)).map(({id,approved,available,compliance,expiresOn})=>({id,approved,available,compliance,expiresOn}));
 const vehicles=ops.store.list('vehicle',actor.tenantId).filter(item=>vehicleIds.has(item.id)).map(({id,approved,available,maintenance,capacityLb})=>({id,approved,available,maintenance,capacityLb}));
 const actions=[
  ...operational.map(item=>({loadId:item.loadId,resourceId:item.id,action:'review_operational_exception',evidenceKind:'exception'})),
  ...documents.map(item=>({loadId:item.loadId,resourceId:item.id,action:'review_document_exception',evidenceKind:'documentexception'})),
  ...approvals.map(item=>({loadId:item.loadId,resourceId:item.id,action:'human_approval',evidenceKind:'approval'})),
  ...pendingCapacity.map(item=>({loadId:item.loadId,resourceId:item.id,action:'review_capacity_proposal',evidenceKind:'capacityproposal'})),
  ...loads.filter(load=>dispatchable.includes(load.status)&&!load.driverId).map(load=>({loadId:load.id,resourceId:load.id,action:'request_capacity_recommendation',evidenceKind:'load'}))
 ];
 return {controlTower:{...provenance,generatedAt:ops.now().toISOString(),shipmentCount:loads.length,activeShipmentCount:loads.filter(load=>!['delivered','void'].includes(load.status)).length,
  openExceptionCount:operational.length+documents.length,pendingApprovalCount:approvals.length+pendingCapacity.length,drivers,vehicles,actions,
  note:'Visible shipment evidence and deterministic advice. No model provider, live GPS, or autonomous dispatch.'},
  routes,risks,capacityProposals,costSummary:costView(ops,actor,loads,routes)};
}
export function createIntelligenceExtensions(){
 return {
  'route:evaluate':(ops,actor,c)=>{
   human(actor);const p=c.payload??{};fields(p,['distanceMiles','averageMph','handlingMinutes','departureAt','source']);
   const load=ops.read('load',c.resourceId,actor,'intelligence:analyze');ops.version(load,c.expectedVersion);
   requireValue(!['delivered','void'].includes(load.status),'ROUTE_STATE','Evaluate routes for incomplete shipments.',409);
   const distanceMiles=finite(p.distanceMiles,0.1,20000,'Distance'),averageMph=finite(p.averageMph,1,85,'Average speed'),handlingMinutes=finite(p.handlingMinutes,0,1440,'Handling time');
   requireValue(['user_estimate','local_fixture'].includes(p.source),'ROUTE_SOURCE','Identify the distance and speed as a user estimate or local fixture.');
   const departureAt=utc(p.departureAt),remaining=load.stops.filter(stop=>!stop.completedAt);
   requireValue(remaining.length>0,'ROUTE_STOPS','No incomplete route stops remain.',409);
   const durationMinutes=Math.ceil(distanceMiles/averageMph*60+handlingMinutes),arrivalTime=Date.parse(departureAt)+durationMinutes*60000;
   requireValue(Number.isFinite(arrivalTime)&&Math.abs(arrivalTime)<=8.64e15,'ROUTE_INPUT','Estimated arrival is outside the supported timestamp range.');
   const estimatedArrivalAt=new Date(arrivalTime).toISOString(),dueAt=remaining.at(-1).at,constraints=[];
   if(estimatedArrivalAt>dueAt)constraints.push('ESTIMATED_LATE_DELIVERY');
   if(remaining[0].type==='pickup'&&departureAt<remaining[0].at)constraints.push('DEPARTURE_BEFORE_PICKUP_WINDOW');
   const completed=load.stops.filter(stop=>stop.completedAt).at(-1);
   requireValue(!completed||departureAt>=completed.completedAt,'ROUTE_DEPARTURE','Departure cannot predate the most recent completed milestone.');
   return ops.create(actor,'routeevaluation',{loadId:load.id,loadVersion:load.version,...provenance,source:p.source,method:'constant_speed_total_duration',confidence:'low',
    distanceMiles,averageMph,handlingMinutes,departureAt,durationMinutes,estimatedArrivalAt,dueAt,onTimeEstimate:estimatedArrivalAt<=dueAt,constraints,
    evidence:{stopIds:remaining.map(stop=>stop.id),distanceBasis:p.source,speedBasis:p.source,loadVersion:load.version},
    explanation:'Total supplied distance divided by supplied average speed, plus handling time. Intermediate leg times, traffic, driver hours, and road constraints are unverified.',
    createdAt:ops.now().toISOString(),createdBy:actor.id},c.action);
  },
  'risk:analyze':(ops,actor,c)=>{
   human(actor);fields(c.payload??{},[]);const load=ops.read('load',c.resourceId,actor,'intelligence:analyze');ops.version(load,c.expectedVersion);
   const now=ops.now().toISOString(),rules=[],route=latest(ops,actor,'routeevaluation',load.id);
   if(!['delivered','void'].includes(load.status)){
    const missed=load.stops.filter(stop=>!stop.completedAt&&stop.at<now);
    if(missed.length)rules.push({code:'MISSED_MILESTONE',points:50,basis:'observed_schedule',confidence:'high',stopIds:missed.map(stop=>stop.id),explanation:'The scheduled milestone time passed without a completion event.'});
    if(route&&route.loadVersion===load.version&&route.estimatedArrivalAt>route.dueAt)rules.push({code:'ESTIMATED_DELAY',points:40,basis:'user_supplied_estimate',confidence:'low',routeEvaluationId:route.id,explanation:'The deterministic arrival estimate is later than the final scheduled stop.'});
    if(route&&route.loadVersion!==load.version)rules.push({code:'STALE_ROUTE_ESTIMATE',points:10,basis:'observed_version',confidence:'high',routeEvaluationId:route.id,explanation:'The load changed after the route estimate; evaluate the current route.'});
    if(load.driverId&&load.vehicleId){
     const eligibility=ops.eligibility(actor,load.driverId,load.vehicleId,load,load.id);
     if(!eligibility.eligible)rules.push({code:'CAPACITY_INELIGIBLE',points:70,basis:'current_eligibility',confidence:'high',driverId:load.driverId,vehicleId:load.vehicleId,reasons:eligibility.reasons,explanation:'Assigned capacity no longer satisfies current dispatch checks.'});
    }else if(dispatchable.includes(load.status))rules.push({code:'UNASSIGNED_CAPACITY',points:30,basis:'observed_assignment',confidence:'high',explanation:'Validated shipment has no driver and vehicle assignment.'});
   }
   for(const kind of ['exception','documentexception']){
    const open=ops.store.list(kind,actor.tenantId).filter(item=>item.loadId===load.id&&item.status==='open');
    if(open.length)rules.push({code:kind==='exception'?'OPEN_OPERATIONAL_EXCEPTION':'OPEN_DOCUMENT_EXCEPTION',points:20,basis:'observed_event',confidence:'high',resourceIds:open.map(item=>item.id),explanation:'An unresolved '+(kind==='exception'?'operational':'document')+' exception requires human review.'});
   }
   const score=Math.min(100,rules.reduce((sum,rule)=>sum+rule.points,0)),escalation=score>=70?'carrier':score>=30?'dispatcher':'monitor';
   return ops.create(actor,'risk',{loadId:load.id,loadVersion:load.version,...provenance,status:'advisory',score,scoreMeaning:'rule priority, not a probability',escalation,
    confidence:rules.some(rule=>rule.confidence==='low')?'mixed':'high',rules,thresholds:{dispatcher:30,carrier:70},createdAt:now,createdBy:actor.id,
    explanation:rules.length?'Review the listed evidence; no shipment or assignment has been changed.':'No configured rule triggered at this checkpoint; this is not a guarantee of on-time delivery.'},c.action);
  },
  'capacity:recommend':(ops,actor,c)=>{
   human(actor);fields(c.payload??{},[]);const load=ops.read('load',c.resourceId,actor,'capacity:recommend');ops.version(load,c.expectedVersion);
   requireValue(dispatchable.includes(load.status),'CAPACITY_STATE','Capacity recommendations require a validated shipment before pickup.',409);
   const drivers=ops.store.list('driver',actor.tenantId),vehicles=ops.store.list('vehicle',actor.tenantId);
   requireValue(drivers.length*vehicles.length<=10000,'CAPACITY_LIMIT','This local matcher supports at most 10,000 candidate pairs.');
   const eligible=[];
   for(const driver of drivers)for(const vehicle of vehicles){
    const check=ops.eligibility(actor,driver.id,vehicle.id,load,load.id);
    if(check.eligible)eligible.push({driver,vehicle,spareCapacityLb:vehicle.capacityLb-load.weightLb,current:driver.id===load.driverId&&vehicle.id===load.vehicleId});
   }
   eligible.sort((a,b)=>Number(b.current)-Number(a.current)||a.spareCapacityLb-b.spareCapacityLb||a.driver.id.localeCompare(b.driver.id)||a.vehicle.id.localeCompare(b.vehicle.id));
   const pair=eligible[0],at=ops.now().toISOString();
   const proposal=ops.create(actor,'capacityproposal',{loadId:load.id,loadVersion:load.version,...provenance,algorithm:'preserve_eligible_assignment_then_smallest_capacity_fit',confidence:'deterministic_constraints',
    driverId:pair?.driver.id??null,vehicleId:pair?.vehicle.id??null,driverVersion:pair?.driver.version??null,vehicleVersion:pair?.vehicle.version??null,
    status:pair?'pending':'no_match',eligiblePairCount:eligible.length,evaluatedPairCount:drivers.length*vehicles.length,spareCapacityLb:pair?.spareCapacityLb??null,
    requestedBy:actor.id,createdAt:at,expiresAt:new Date(ops.now().getTime()+30*60000).toISOString(),
    explanation:pair?'Candidate satisfies current carrier approval, compliance, availability, fleet relationship and capacity checks. Existing eligible assignment is preferred, then smallest spare capacity; travel distance is not scored.':'No eligible driver and vehicle pair satisfies current carrier constraints.',
    prohibitedAutonomousActions:['assignment','financial_approval','payment'],overridePolicy:'Create a fresh proposal and obtain a new independent human approval.'},c.action);
   for(const old of ops.store.list('capacityproposal',actor.tenantId).filter(item=>item.loadId===load.id&&item.id!==proposal.id&&['pending','approved'].includes(item.status)))ops.change(actor,old,{status:'superseded',supersededBy:proposal.id,supersededAt:at},'capacity:supersede','A new recommendation requires its own human review.');
   return proposal;
  },
  'capacity:decide':(ops,actor,c)=>{
   human(actor);const p=c.payload??{};fields(p,['decision','reason']);requireValue(['approved','rejected'].includes(p.decision),'CAPACITY_DECISION','Choose approved or rejected.');const reason=text(p.reason,300);
   const proposal=ops.read('capacityproposal',c.resourceId,actor),load=proposalLoad(ops,actor,proposal,'capacity:approve');ops.guard(actor,'load:dispatch',load);ops.version(proposal,c.expectedVersion);
   requireValue(actor.role==='carrier','HUMAN_REQUIRED','A carrier manager must decide this proposal.',403);
   requireValue(proposal.status==='pending','CAPACITY_STATE','Only pending proposals can be decided.',409);
   requireValue(proposal.requestedBy!==actor.id,'SEPARATION','A different carrier manager must review this recommendation.',403);
   validProposal(ops,actor,proposal,load);
   return ops.change(actor,proposal,{status:p.decision,decidedBy:actor.id,decidedAt:ops.now().toISOString(),decisionReason:reason},c.action,reason);
  },
  'capacity:apply':(ops,actor,c)=>{
   human(actor);const p=c.payload??{};fields(p,['reason']);const reason=text(p.reason,300);
   const proposal=ops.read('capacityproposal',c.resourceId,actor),load=proposalLoad(ops,actor,proposal,'capacity:apply');ops.guard(actor,'load:dispatch',load);ops.version(proposal,c.expectedVersion);
   requireValue(proposal.status==='approved','CAPACITY_STATE','An unused human approval is required.',409);
   authorizedReviewer(ops,actor,proposal,load);validProposal(ops,actor,proposal,load);
   const assigned=ops.perform(actor,{action:'load:assign',resourceId:load.id,expectedVersion:load.version,payload:{driverId:proposal.driverId,vehicleId:proposal.vehicleId,reason}});
   return ops.change(actor,proposal,{status:'applied',appliedBy:actor.id,appliedAt:ops.now().toISOString(),appliedLoadVersion:assigned.version},c.action,reason);
  },
  'cost:record':(ops,actor,c)=>{
   human(actor);const p=c.payload??{};fields(p,['category','amountCents','basis','reference']);const load=ops.read('load',c.resourceId,actor,'cost:manage');ops.version(load,c.expectedVersion);
   requireValue(actor.role==='carrier','HUMAN_REQUIRED','A carrier manager must record cost evidence.',403);
   requireValue(['fuel','labor','exception','other'].includes(p.category)&&['recorded','estimate'].includes(p.basis),'COST_CLASS','Select an allowed cost category and evidence basis.');
   const amountCents=integer(p.amountCents,0,100000000),reference=text(p.reference,120);
   requireValue(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/.test(reference),'COST_REFERENCE','Use an evidence identifier without personal data or free-form notes.');
   requireValue(!ops.store.list('operationcost',actor.tenantId).some(cost=>cost.loadId===load.id&&cost.reference===reference),'COST_DUPLICATE','This shipment already has a cost entry with that evidence reference.',409);
   return ops.create(actor,'operationcost',{loadId:load.id,loadVersion:load.version,category:p.category,amountCents,basis:p.basis,reference,currency:'USD',source:'human_entered',recordedBy:actor.id,recordedAt:ops.now().toISOString(),externalTransaction:false},c.action);
  }
 };
}
export const intelligenceIntegritySQL=`
 CREATE TRIGGER IF NOT EXISTS intelligence_evidence_no_update BEFORE UPDATE ON resources WHEN OLD.kind IN ('routeevaluation','risk','operationcost') BEGIN SELECT RAISE(ABORT,'Intelligence evidence is immutable'); END;
 CREATE TRIGGER IF NOT EXISTS intelligence_evidence_no_delete BEFORE DELETE ON resources WHEN OLD.kind IN ('routeevaluation','risk','operationcost','capacityproposal') BEGIN SELECT RAISE(ABORT,'Intelligence evidence cannot be deleted'); END;
 CREATE UNIQUE INDEX IF NOT EXISTS unique_cost_evidence ON resources(tenant_id,json_extract(data,'$.loadId'),json_extract(data,'$.reference')) WHERE kind='operationcost';
 CREATE TRIGGER IF NOT EXISTS capacity_evidence_immutable BEFORE UPDATE ON resources WHEN OLD.kind='capacityproposal' AND (NEW.kind<>OLD.kind OR NEW.id<>OLD.id OR NEW.tenant_id<>OLD.tenant_id OR json_remove(NEW.data,'$.version','$.status','$.decidedBy','$.decidedAt','$.decisionReason','$.appliedBy','$.appliedAt','$.appliedLoadVersion','$.supersededBy','$.supersededAt')<>json_remove(OLD.data,'$.version','$.status','$.decidedBy','$.decidedAt','$.decisionReason','$.appliedBy','$.appliedAt','$.appliedLoadVersion','$.supersededBy','$.supersededAt')) BEGIN SELECT RAISE(ABORT,'Capacity evidence is immutable; request a new recommendation'); END;
`;
