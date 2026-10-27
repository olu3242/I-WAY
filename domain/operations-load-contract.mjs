// Pure validation of load:create payload shared by future async migration.
// No storage access or authorization is performed here.
import {fields,text,integer,utc,requireValue} from './operations-errors.mjs';
export function normalizeLoadCreatePayload(p){
 fields(p,['reference','customer','customerId','dispatcherId','commodity','weightLb','stops','rateCents','charges','factored','factorName','dimensions','privateNotes','billTo','paymentTerms']);
 requireValue(Array.isArray(p.stops)&&p.stops.length>=2&&p.stops.length<=20,'STOPS','Provide pickup and delivery stops.');
 const stops=p.stops.map((s,index)=>{
  fields(s,['type','location','at','windowEnd','privateNotes','facilityId']);
  requireValue(['pickup','delivery'].includes(s.type),'STOP','Invalid stop type.');
  const at=utc(s.at),windowEnd=s.windowEnd?utc(s.windowEnd):null;
  requireValue(!windowEnd||windowEnd>=at,'STOP_WINDOW','The appointment window must end after it starts.');
  return {id:'stop-'+index,type:s.type,location:text(s.location),at,completedAt:null,...(windowEnd?{windowEnd}:{}),...(s.privateNotes?{privateNotes:text(s.privateNotes,1000)}:{}),...(s.facilityId?{facilityId:text(s.facilityId,100)}:{})};
 });
 requireValue(stops[0].type==='pickup'&&stops.at(-1).type==='delivery'&&stops.every((s,i)=>i===0||s.at>=stops[i-1].at),'STOPS','Stops must be ordered from pickup to delivery.');
 requireValue(stops.every((s,i)=>s.type!=='pickup'||!stops.slice(0,i).some(previous=>previous.type==='delivery')),'STOPS','Complete all pickups before delivery stops.');
 const charges=p.charges??[];
 requireValue(Array.isArray(charges)&&charges.length<=20,'CHARGES','Invalid charges.');
 const normalizedCharges=charges.map(x=>{fields(x,['label','amountCents']);return {label:text(x.label,80),amountCents:integer(x.amountCents)};});
 requireValue(p.factored===undefined||typeof p.factored==='boolean','BILLING','Invalid factoring value.');
 return {
  reference:text(p.reference,40),customer:text(p.customer),customerId:p.customerId||null,
  dispatcherId:text(p.dispatcherId),commodity:text(p.commodity),weightLb:integer(p.weightLb,1,200000),
  stops,rateCents:integer(p.rateCents),charges:normalizedCharges,
  factored:p.factored===true,factorName:p.factored?text(p.factorName):null,
  ...(p.dimensions?{dimensions:text(p.dimensions,120)}:{}),...(p.privateNotes?{privateNotes:text(p.privateNotes,1000)}:{}),...(p.billTo&&!p.factored?{billTo:text(p.billTo)}:{}),...(p.paymentTerms?{paymentTerms:text(p.paymentTerms,80)}:{})
 };
}
