/** PostgreSQL adapter for trusted backend use. Supply a dedicated restricted pool. */
export function createQaPersonaPostgres({pool}={}){
 if(typeof pool?.connect!=='function')throw Error('QA_DB_POOL_REQUIRED');
 const transaction=async fn=>{
  const client=await pool.connect();
  try{
   await client.query('BEGIN');
   const result=await fn(client);
   await client.query('COMMIT');
   return result;
  }catch(error){try{await client.query('ROLLBACK')}catch{}throw error}
  finally{client.release()}
 };
 return Object.freeze({
  async issue(session,audit){
   return transaction(async db=>{
    await db.query(`INSERT INTO iway_private.qa_persona_sessions
      (id,actor_id,target_id,tenant_id,effective_role,reason,issued_at,expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,to_timestamp($7 / 1000.0),to_timestamp($8 / 1000.0))`,
      [session.id,session.actorId,session.targetId,session.tenantId,session.role,session.reason,session.issuedAt,session.expiresAt]);
    await db.query(`INSERT INTO iway_private.qa_persona_audit
      (event,actor_id,effective_actor_id,tenant_id,session_id)
      VALUES ('qa_persona_started',$1,$2,$3,$4)`,
      [audit.actorId,audit.effectiveActorId,audit.tenantId,session.id]);
    return session;
   });
  },
  async read(id){
   const result=await pool.query(`SELECT id::text,actor_id,target_id,tenant_id,effective_role,reason,
    (extract(epoch from issued_at)*1000)::bigint AS issued_ms,
    (extract(epoch from expires_at)*1000)::bigint AS expires_ms,
    revoked_at IS NOT NULL AS revoked
    FROM iway_private.qa_persona_sessions WHERE id=$1`,[id]);
   const row=result.rows[0];if(!row)return null;
   return {id:row.id,actorId:row.actor_id,targetId:row.target_id,tenantId:row.tenant_id,
    role:row.effective_role,reason:row.reason,issuedAt:Number(row.issued_ms),
    expiresAt:Number(row.expires_ms),revoked:row.revoked};
  },
  async stop({sessionId,actorId,effectiveActorId,tenantId}){
   return transaction(async db=>{
    const result=await db.query(`UPDATE iway_private.qa_persona_sessions SET revoked_at=now()
     WHERE id=$1 AND actor_id=$2 AND target_id=$3 AND tenant_id=$4 AND revoked_at IS NULL
     AND expires_at>now() RETURNING id`,[sessionId,actorId,effectiveActorId,tenantId]);
    if(result.rowCount!==1)throw Error('QA_PERSONA_DENIED');
    await db.query(`INSERT INTO iway_private.qa_persona_audit
     (event,actor_id,effective_actor_id,tenant_id,session_id)
     VALUES ('qa_persona_stopped',$1,$2,$3,$4)`,[actorId,effectiveActorId,tenantId,sessionId]);
    return {revoked:true};
   });
  }
 });
}
