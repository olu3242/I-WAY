// Restricted internal database identity boundary. Only call from server-side
// authenticated and membership-verified operations. Never accept browser claims.
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9_.-]{1,100}$/.test(x);
export function requireSopIdentity(identity){
 if(!identity||identity.verified!==true||identity.tenantMembershipVerified!==true||!valid(identity.subjectId)||!valid(identity.tenantId))throw Error('SOP_VERIFIED_IDENTITY_REQUIRED');
 return {tenantId:identity.tenantId,actorId:identity.subjectId};
}
export async function withSopTransaction(pool,identity,run){
 const {tenantId,actorId}=requireSopIdentity(identity);
 if(typeof pool?.connect!=='function'||typeof run!=='function')throw Error('SOP_TRANSACTION_INVALID');
 const client=await pool.connect();
 let began=false;
 try{
  await client.query('BEGIN');began=true;
  // PostgreSQL set_config(..., true) scopes context to this transaction.
  await client.query('SELECT set_config($1,$2,true),set_config($3,$4,true)',[
   'iway.verified_tenant',tenantId,'iway.verified_actor',actorId
  ]);
  const result=await run(client,{tenantId,actorId});
  await client.query('COMMIT');
  return result;
 }catch(e){if(began)try{await client.query('ROLLBACK')}catch{}throw e}
 finally{client.release()}
}
