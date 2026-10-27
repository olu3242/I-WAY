import {createOperationsFeatures} from '../../domain/operations-features.mjs';
import {fixture} from './operations-fixture.mjs';
export const terms={payeeType:'driver',week:'2026-11-02',shareBps:10000,adminFeeBps:1000,deductions:[{code:'fuel',amountCents:320000},{code:'insurance',amountCents:40000},{code:'other',amountCents:15000}],escrowInstallmentCents:30000,escrowTargetCents:100000,roundingPolicy:'half_up_cent_v1',reason:'Illustrative terms explicitly agreed for testing only'};
export async function settlementFixture(t,{fleet=false}={}){
 return configureSettlementFixture(await fixture(t,createOperationsFeatures()),{fleet});
}
export function configureSettlementFixture(f,{fleet=false}={}){
 if(fleet){for(const kind of ['driver','vehicle']){const id=kind==='driver'?f.driver.id:f.vehicle.id,r=f.store.get(kind,id,f.manager.tenantId);f.store.update(kind,id,f.manager.tenantId,r.version,{fleetId:f.fleet.id});}f.store.db.prepare("UPDATE users SET data=json_set(data,'$.fleetId',?) WHERE id=?").run(f.fleet.id,f.driver.id);f.driver=f.store.principal(f.driver.id);}
 f.complete=(patch={})=>{
  const clock=patch.stops?.find(s=>s.type==='pickup')?.at??'2026-11-02T14:00:00.000Z';f.ops.now=()=>new Date(clock);
  let load=f.createLoad();
  load=f.store.update('load',load.id,f.manager.tenantId,load.version,{rateCents:1800000,charges:[],...patch});
  load=f.command(f.dispatcher,'load:validate',load);load=f.command(f.dispatcher,'load:assign',load,{driverId:f.driver.id,vehicleId:f.vehicle.id,reason:'Illustrative valid relationship'});
  load=f.command(f.driver,'load:accept',load);load=f.command(f.driver,'load:pickup',load,{stopId:load.stops[0].id});load=f.command(f.driver,'load:transit',load);
  const doc=f.command(f.dispatcher,'document:ingest',load,{type:'BOL',mimeType:'application/json',content:JSON.stringify({loadReference:load.reference,shipper:'Illustrative shipper',consignee:'Illustrative recipient',commodity:load.commodity,weightLb:load.weightLb,pickupLocation:load.stops[0].location,deliveryLocation:load.stops.at(-1).location})});
  f.command(f.dispatcher,'document:review',doc,{decision:'validate',reason:'Illustrative shipping fields verified'});
  f.command(f.driver,'pod:record',load,{stopId:load.stops.at(-1).id,recipientAcknowledged:true,evidenceReference:'ILL-ACK'});
  return f.command(f.driver,'load:deliver',load,{stopId:load.stops.at(-1).id,proofReference:'ILL-PROOF'});
 };
 f.prepare=(patch={})=>f.command(f.manager,'settlement:create',null,{...terms,payeeType:fleet?'fleet':'driver',payeeId:fleet?f.fleet.id:f.driver.id,...patch});
 return f;
}
