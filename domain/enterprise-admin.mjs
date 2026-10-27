/** Enterprise administration policy layer. This module does not replace domain/authorization.mjs or PostgreSQL RLS. */
import { authorize, rolePermissions } from './authorization.mjs';

export const ADMIN_SECTIONS=Object.freeze(['company','business-units','locations','users','roles','permission-sets','field-security','validation-rules','page-layouts','related-tabs','approvals','ai-policies','audit']);
export const FIELD_ACTIONS=Object.freeze(['read','create','update','export','filter']);
export const DEFAULT_FIELD_RULES=Object.freeze({
 'load.carrierRate':{read:['carrier'],update:['carrier'],export:['carrier']},
 'load.margin':{read:['carrier'],export:['carrier']},
 'driver.licenseNumber':{read:['carrier'],update:['carrier']},
 'vehicle.vin':{read:['carrier','fleet'],update:['carrier','fleet']},
 'payment.bankDetails':{read:[],update:[],export:[]}
});
const safeId=x=>typeof x==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(x);
const activeActor=a=>!!a?.id&&!!a?.tenantId&&a.active!==false;
export function validateOrganizationSettings(input){
 const errors=[];
 if(!input||typeof input!=='object'||Array.isArray(input))return {valid:false,errors:['settings must be an object']};
 if(typeof input.legalName!=='string'||!input.legalName.trim()||input.legalName.length>200)errors.push('legalName required (max 200)');
 if(input.timeZone!==undefined&&(!Intl.supportedValuesOf('timeZone').includes(input.timeZone)))errors.push('invalid timeZone');
 if(input.currency!==undefined&&!/^[A-Z]{3}$/.test(input.currency))errors.push('currency must be ISO-style three-letter code');
 if(input.dotNumber!==undefined&&!/^\d{1,12}$/.test(String(input.dotNumber)))errors.push('invalid DOT number');
 return {valid:errors.length===0,errors};
}
/** Additional permission sets only intersect existing role permissions: never expand authority implicitly. */
export function effectivePermission(actor,action,resource,{grants=[],denials=[]}={}){
 if(!activeActor(actor)||!resource||actor.tenantId!==resource.tenantId)return false;
 if(denials.includes(action))return false;
 if(!rolePermissions[actor.role]?.includes(action))return false;
 if(!actor.permissions?.includes(action))return false;
 if(grants.length&& !grants.includes(action))return false;
 return authorize({actor,action,resource});
}
export function canAccessField({actor,resource,object,field,operation='read',rules=DEFAULT_FIELD_RULES,grants=[],denials=[]}){
 if(!FIELD_ACTIONS.includes(operation)||!safeId(object)||!safeId(field))return false;
 const action=object==='load'?'load:view':object==='vehicle'?'asset:view':object==='driver'?'asset:view':null;
 if(!action||!effectivePermission(actor,action,resource,{grants,denials}))return false;
 const rule=Object.hasOwn(rules,`${object}.${field}`)?rules[`${object}.${field}`]:null;
 if(!rule)return false; // unregistered fields are not automatically exposed
 return Array.isArray(rule[operation])&&rule[operation].includes(actor.role);
}
export function projectAuthorizedFields({actor,resource,object,record,rules=DEFAULT_FIELD_RULES}){
 if(!record||typeof record!=='object'||Array.isArray(record))return {};
 return Object.fromEntries(Object.entries(record).filter(([field])=>canAccessField({actor,resource,object,field,rules})));
}
export function validateRuleDefinition(rule){
 if(!rule||typeof rule!=='object'||Array.isArray(rule))return false;
 return safeId(rule.id)&&safeId(rule.object)&&['required','min','max','enum'].includes(rule.operator)&&safeId(rule.field)&&rule.enabled!==false&&Number.isSafeInteger(rule.version)&&rule.version>=1;
}
/** Closed operator set; never evaluate tenant-provided JavaScript or SQL. */
export function evaluateValidationRule(rule,record){
 if(!validateRuleDefinition(rule)||!record||typeof record!=='object')return {valid:false,code:'INVALID_RULE'};
 const value=record[rule.field];
 let valid=false;
 switch(rule.operator){
 case 'required':valid=value!==null&&value!==undefined&&String(value).trim()!=='';break;
 case 'min':valid=typeof value==='number'&&Number.isFinite(value)&&typeof rule.value==='number'&&value>=rule.value;break;
 case 'max':valid=typeof value==='number'&&Number.isFinite(value)&&typeof rule.value==='number'&&value<=rule.value;break;
 case 'enum':valid=Array.isArray(rule.value)&&rule.value.includes(value);break;
 }
 return {valid,code:valid?'PASS':rule.id};
}
