/** Tenant-scoped validation rules evaluated before persistence.
 * Rules are additive constraints; they cannot relax domain validation.
 */
import {evaluateValidationRule,validateRuleDefinition} from './enterprise-admin.mjs';
export function validateConfiguredRecord(store,tenantId,kind,record){
 if(!store?.db?.prepare?.("SELECT 1 FROM sqlite_master WHERE type='table' AND name='organization_admin'").get())return {valid:true};
 const rows=store.db.prepare("SELECT id,data FROM organization_admin WHERE tenant_id=? AND kind='validation-rule' ORDER BY id LIMIT 200").all(tenantId);
 for(const row of rows){
  let rule;try{rule=JSON.parse(row.data)}catch{return {valid:false,code:'INVALID_RULE'};}
  if(rule.object!==kind||rule.enabled===false)continue;
  const normalized={...rule,id:row.id,version:1,enabled:true};
  if(!validateRuleDefinition(normalized))return {valid:false,code:'INVALID_RULE'};
  const result=evaluateValidationRule(normalized,record);
  if(!result.valid)return {valid:false,code:'VALIDATION_RULE',ruleId:row.id};
 }
 return {valid:true};
}
