import {authorize} from './authorization.mjs';
import {businessSummary} from './operations-business.mjs';
import {fields,text,utc,requireValue} from './operations-errors.mjs';
const can=(actor,action,resource)=>authorize({actor,action,resource});
const ratio=(n,d,unit,basis)=>({value:d?n/d:null,numerator:n,denominator:d,unit,basis});
export function createMeasurementExtensions(){return {
 'measurement:record':(ops,actor,c)=>{
  fields(c.payload??{},['actualMiles','reference','observedAt','routeId']);const p=c.payload;
  const load=ops.read('load',c.resourceId,actor,'cost:manage');ops.guard(actor,'load:view',load);ops.version(load,c.expectedVersion);
  requireValue(actor.role==='carrier'&&load.status==='delivered','MEASUREMENT_STATE','Record actual distance only for a delivered shipment.',409);
  requireValue(typeof p.actualMiles==='number'&&Number.isFinite(p.actualMiles)&&p.actualMiles>0&&p.actualMiles<=20000,'DISTANCE','Provide a supported positive distance.');
  const observedAt=utc(p.observedAt),reference=text(p.reference,100);
  requireValue(observedAt<=ops.now().toISOString()&&observedAt>=load.deliveredAt,'OBSERVATION_TIME','Observation must follow delivery and cannot be future-dated.');
  requireValue(/^[A-Za-z0-9_-]{3,100}$/.test(reference),'EVIDENCE_REFERENCE','Use an evidence identifier, without personal data.');
  requireValue(!ops.store.list('measurement',actor.tenantId).some(m=>m.loadId===load.id),'MEASUREMENT_EXISTS','Distance evidence already exists for this shipment.',409);
  let route=null;if(p.routeId){route=ops.read('routeevaluation',text(p.routeId,100),actor);requireValue(route.loadId===load.id&&route.createdAt<=load.deliveredAt,'BASELINE','Choose an earlier estimate on this shipment.');}
  return ops.create(actor,'measurement',{loadId:load.id,loadVersion:load.version,actualMiles:p.actualMiles,reference,observedAt,routeId:route?.id??null,estimatedMiles:route?.distanceMiles??null,source:'user_reported',verification:'not_independently_verified',createdAt:ops.now().toISOString()},c.action);
 }
};}
export function measurementState(ops,actor,visibleLoads){
 const base=businessSummary(ops,actor,visibleLoads);if(!base)return {operationalMetrics:null};
 const loads=visibleLoads.filter(l=>can(actor,'analytics:view',l)&&can(actor,'load:view',l)),ids=new Set(loads.map(l=>l.id));
 const proposals=ops.store.list('capacityproposal',actor.tenantId).filter(p=>ids.has(p.loadId)),decided=proposals.filter(p=>['approved','applied','rejected'].includes(p.status)),applied=proposals.filter(p=>p.status==='applied');
 const delivered=new Set(loads.filter(l=>l.status==='delivered').map(l=>l.id)),appliedDelivered=applied.filter(p=>delivered.has(p.loadId)),onTimeIds=new Set(base.onTimeDelivery.evidence.filter(e=>e.onTime).map(e=>e.loadId));
 const costAllowed=actor.role==='carrier'&&can(actor,'cost:manage',{tenantId:actor.tenantId});
 const costs=costAllowed?ops.store.list('operationcost',actor.tenantId).filter(c=>ids.has(c.loadId)):[];
 const recorded=costs.filter(c=>c.basis==='recorded'),estimated=costs.filter(c=>c.basis==='estimate'),measured=new Set(recorded.map(c=>c.loadId));
 const measurements=costAllowed?ops.store.list('measurement',actor.tenantId).filter(m=>ids.has(m.loadId)):[];
 const sum=items=>{const result=items.reduce((n,c)=>n+c.amountCents,0);requireValue(Number.isSafeInteger(result),'MEASUREMENT_RANGE','Metric exceeds supported integer range.');return result;};
 return {operationalMetrics:{...base,methodVersion:'iway-metrics-v1',
  costs:costAllowed?{recordedCents:sum(recorded),estimatedCents:sum(estimated),costPerMeasuredLoad:ratio(sum(recorded),measured.size,'USD cents','Only loads with recorded cost evidence; user-reported, not bank-verified.'),missingCostLoads:loads.filter(l=>!measured.has(l.id)).length,evidenceIds:costs.map(c=>c.id)}:null,
  distance:measurements.map(m=>({loadId:m.loadId,evidenceId:m.id,source:m.source,verification:m.verification,actualMiles:m.actualMiles,estimatedMiles:m.estimatedMiles,routeId:m.routeId,varianceMiles:m.estimatedMiles===null?null:m.actualMiles-m.estimatedMiles,plannedToActualRatio:m.estimatedMiles===null?null:m.estimatedMiles/m.actualMiles,costPerReportedMileCents:recorded.some(c=>c.loadId===m.loadId)?sum(recorded.filter(c=>c.loadId===m.loadId))/m.actualMiles:null})),
  recommendations:{decided:decided.length,approved:decided.filter(p=>p.status!=='rejected').length,applied:applied.length,deliveredAfterApplication:appliedDelivered.length,onTimeAfterApplication:appliedDelivered.filter(p=>onTimeIds.has(p.loadId)).length,evidenceIds:proposals.map(p=>p.id),acceptance:ratio(decided.filter(p=>p.status!=='rejected').length,decided.length,'fraction','Approved or applied / approved, applied or rejected proposals; expired/superseded pending proposals excluded.'),causalImpact:null},
  roi:{savingsCents:null,roiPercent:null,reason:'No approved counterfactual cost baseline or attributable benefit evidence.'},
  limitations:['User-reported distances and costs are not independently verified.','Planned/actual distance ratio is a comparison, not measured route optimality.','Recommendation adoption and delivery outcomes do not establish causation.']}
 };
}
export const measurementIntegritySQL=`
 CREATE UNIQUE INDEX IF NOT EXISTS one_distance_evidence ON resources(tenant_id,json_extract(data,'$.loadId')) WHERE kind='measurement';
 CREATE TRIGGER IF NOT EXISTS measurement_no_update BEFORE UPDATE ON resources WHEN OLD.kind='measurement' BEGIN SELECT RAISE(ABORT,'Measurement evidence is immutable'); END;
 CREATE TRIGGER IF NOT EXISTS measurement_no_delete BEFORE DELETE ON resources WHEN OLD.kind='measurement' BEGIN SELECT RAISE(ABORT,'Measurement evidence is immutable'); END;
`;
