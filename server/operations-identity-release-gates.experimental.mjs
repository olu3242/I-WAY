// B434: explicit preproduction release gate. This does not perform a deployment.
// Evidence must be supplied by independent hosted checks, not asserted by fixtures.
const required=[
 'hosted_oidc_jwks_rotation','session_renewal_revocation',
 'tenant_role_api_authorization','restricted_hosted_postgres_rls',
 'durable_nonce_custody_atomic_fencing','process_restart_and_db_failover',
 'four_persona_isolated_e2e','independent_security_review',
 'pr_stack_reconciled','explicit_production_approval'
];
export const requiredReleaseGates=Object.freeze([...required]);
export function evaluateIwayIdentityRelease(evidence={}){
 const missing=required.filter(name=>evidence[name]!==true);
 return Object.freeze({decision:missing.length===0?'READY_FOR_HUMAN_GO_REVIEW':'NO_GO',
  missing:Object.freeze(missing),productionAccessAuthorized:false});
}
