import test from 'node:test';
import assert from 'node:assert/strict';
import {createPostgresOnlyNonceReconciler} from '../server/operations-pg-only-nonce-reconciler.experimental.mjs';
test('B435 only activated exactly-once tenant bindings are eligible',async()=>{
 const scope={invitationId:'i',tenantId:'t'};
 const good=createPostgresOnlyNonceReconciler({activationLookup:async()=>({state:'ACTIVE',bindingCount:1})});
 assert.deepEqual(await good.reconcile(scope),{reconciled:true});
 for(const activation of [null,{state:'VERIFIED',bindingCount:1},{state:'ACTIVE',bindingCount:0},{state:'ACTIVE',bindingCount:2}]){
  const denied=createPostgresOnlyNonceReconciler({activationLookup:async()=>activation});
  assert.deepEqual(await denied.reconcile(scope),{reconciled:false});
 }
});
test('B435 missing tenant scope fails closed',async()=>{
 const reconciler=createPostgresOnlyNonceReconciler({activationLookup:async()=>({state:'ACTIVE',bindingCount:1})});
 await assert.rejects(reconciler.reconcile({invitationId:'i'}),/INVALID_NONCE_RECOVERY_SCOPE/);
});
