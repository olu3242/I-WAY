import test from 'node:test';
import assert from 'node:assert/strict';
import {createNonceCleanupReconciler} from '../server/operations-nonce-cleanup-reconciler.experimental.mjs';
const invitationId='invite',tenantId='tenant';
test('clears nonce only for committed ACTIVE invitation with one binding',async()=>{
 let cleared=0;
 const reconciler=createNonceCleanupReconciler({
  lookupActivation:async()=>({invitationId,tenantId,state:'ACTIVE',bindingCount:1}),
  clearNonce:async()=>{cleared++;}
 });
 assert.deepEqual(await reconciler.reconcile({invitationId,tenantId}),{reconciled:true});
 assert.equal(cleared,1);
});
for(const [name,override] of [
 ['pending',{state:'VERIFIED'}],['revoked',{state:'REVOKED'}],
 ['missing binding',{bindingCount:0}],['duplicate binding',{bindingCount:2}],
 ['wrong tenant',{tenantId:'other'}]
]){
 test('rejects cleanup for '+name,async()=>{
  let cleared=0;
  const reconciler=createNonceCleanupReconciler({
   lookupActivation:async()=>({invitationId,tenantId,state:'ACTIVE',bindingCount:1,...override}),
   clearNonce:async()=>{cleared++;}
  });
  assert.deepEqual(await reconciler.reconcile({invitationId,tenantId}),{reconciled:false,reason:'NOT_ACTIVATED'});
  assert.equal(cleared,0);
 });
}
test('cleanup outage propagates and can be safely retried',async()=>{
 let attempts=0;
 const reconciler=createNonceCleanupReconciler({
  lookupActivation:async()=>({invitationId,tenantId,state:'ACTIVE',bindingCount:1}),
  clearNonce:async()=>{if(++attempts===1)throw Error('OUTAGE');}
 });
 await assert.rejects(reconciler.reconcile({invitationId,tenantId}),/OUTAGE/);
 assert.deepEqual(await reconciler.reconcile({invitationId,tenantId}),{reconciled:true});
});
