// B445 isolated recovery certification: no hosted evidence is inferred from
// fixture CI. This evaluates only explicitly observed recovery gate results.
export const recoveryChecks=Object.freeze([
 'process_kill_recovery','backend_termination_recovery',
 'postgres_service_restart','post_restart_fence_takeover',
 'atomic_cleanup_race','secret_free_telemetry'
]);
export function evaluateRecoveryReadiness(evidence={}){
 const missing=recoveryChecks.filter(key=>evidence[key]!==true);
 return Object.freeze({status:missing.length?'NOT_CERTIFIED':'ISOLATED_CI_READY',
  missing:Object.freeze(missing),hostedCertified:false,productionAuthorized:false});
}
