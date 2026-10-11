import {transitionAIPolicy} from '../lib/intelligence/policy-lifecycle.mjs';
import {requireValue,fields} from './operations-errors.mjs';

// Installed as an Operations extension; execute() supplies transaction,
// idempotency, refreshed principal, and append-only command audit.
export function createAIPolicyExtensions(){
 const act=(ops,actor,c,action)=>{
  const current=ops.store.list('aipolicy',actor.tenantId)[0]??null;
  const payload=c.payload??{};
  fields(payload,action==='propose'?['policy']:[]);
  ops.guard(actor,'governance:manage',{tenantId:actor.tenantId});
  if(current){requireValue(c.resourceId===current.id,'AI_POLICY_RESOURCE','Use the current policy record.',409);ops.version(current,c.expectedVersion);}
  else requireValue(action==='propose'&&!c.resourceId,'AI_POLICY_RESOURCE','Propose a new policy.',409);
  const transition=transitionAIPolicy(current,{action,policy:payload.policy,expectedVersion:c.expectedVersion},actor);
  requireValue(transition.accepted,'AI_POLICY_TRANSITION','AI policy transition denied.',409);
  const next=current?ops.store.update('aipolicy',current.id,actor.tenantId,current.version,transition.policy):ops.store.insert('aipolicy',actor.tenantId,transition.policy);
  ops.store.audit(actor,c.action,next.id,'success',{lifecycle:next.lifecycle,version:next.version,enabled:next.enabled},ops.now().toISOString());
  return next;
 };
 return {
  'aipolicy:propose':(ops,a,c)=>act(ops,a,c,'propose'),
  'aipolicy:approve':(ops,a,c)=>act(ops,a,c,'approve'),
  'aipolicy:revoke':(ops,a,c)=>act(ops,a,c,'revoke')
 };
}
// Only tenant carrier governance principals may inspect policy configuration.
export function aiPolicyState(ops,actor){
 const permitted=actor?.active===true&&actor.role==='carrier'&&actor.permissions?.includes('governance:manage');
 return {aiPolicies:permitted?ops.store.list('aipolicy',actor.tenantId):[]};
}
export const aiPolicyIntegritySQL=`
 CREATE UNIQUE INDEX IF NOT EXISTS one_tenant_ai_policy ON resources(tenant_id) WHERE kind='aipolicy';
`;
