export const PERSONAS = Object.freeze({
 driver: "driver", owner_operator: "owner_operator", dispatcher: "dispatcher",
 carrier_admin: "carrier_admin", carrier_operations: "carrier_operations",
 fleet_manager: "fleet_manager", fleet_admin: "fleet_admin",
 fleet_compliance: "fleet_compliance", shipper: "shipper",
 finance: "finance", support: "support", platform_operations: "platform_operations",
 security: "security", platform_admin: "platform_admin"
});
export const SOP_CATALOG = Object.freeze([
 ["001","User registration and onboarding","identity"],["002","Login and account recovery","identity"],
 ["003","Carrier verification","carrier"],["004","Driver onboarding","carrier"],
 ["005","Fleet onboarding","fleet"],["006","Load creation","dispatch"],
 ["007","Load assignment","dispatch"],["008","Trip execution","dispatch"],
 ["009","Shipment tracking","dispatch"],["010","Proof of delivery","dispatch"],
 ["011","Document processing","documents"],["012","Dispatch exceptions","dispatch"],
 ["013","Vehicle maintenance","fleet"],["014","Driver compliance","compliance"],
 ["015","Billing and settlements","finance"],["016","Claims and disputes","customer"],
 ["017","Notification failures","operations"],["018","AI approvals","governance"],
 ["019","Ticket escalation","support"],["020","Security and privacy incidents","security"],
 ["021","Tenant permissions","identity"],["022","Integration failures","operations"],
 ["023","Disaster recovery","reliability"],["024","AI answer incidents","governance"],
 ["025","Knowledge publication","knowledge"],["026","Customer feedback","customer"]
].map(([id,title,owner])=>Object.freeze({id:"SOP-"+id,title,owner})));
export const SOP_REQUIRED_FIELDS = Object.freeze(["id","title","owner","purpose","trigger","prerequisites","steps","exceptions","escalation","evidence","successCriteria","version","approvalStatus"]);
export function validateSop(sop) {
 if (!sop || SOP_REQUIRED_FIELDS.some(k=>sop[k]===undefined || sop[k]===null || sop[k]==="")) return false;
 return Array.isArray(sop.steps) && sop.steps.length>0 && ["draft","approved","retired"].includes(sop.approvalStatus);
}
