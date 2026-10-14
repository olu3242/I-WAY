// SOP PostgreSQL adapter. Requires pre-provisioned private tables and a restricted
// tenant-scoped database role; this module never creates schema or grants privileges.
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_.-]{1,100}$/.test(x);
const transitions={open:['triaged'],triaged:['assigned'],assigned:['waiting_customer','resolved'],waiting_customer:['assigned'],resolved:['closed','assigned'],closed:[]};
export function createSopPostgresRepository(pool){
 if(!pool||typeof pool.connect!=='function')throw Error('SOP_POOL_REQUIRED');
 async function transaction(run){
  const client=await pool.connect();
  try{
   await client.query('BEGIN');
   const result=await run(client);
   await client.query('COMMIT');
   return result;
  }catch(e){try{await client.query('ROLLBACK');}catch{}throw e;}
  finally{client.release();}
 }
 return {
  async listApprovedArticles({tenantId,role}){
   if(!id(tenantId)||!id(role))throw Error('SOP_SCOPE_INVALID');
   const client=await pool.connect();
   try{
    const result=await client.query(
     'SELECT id,tenant_id AS "tenantId",title,body,status,approved_by AS "approvedBy",authored_by AS "authoredBy",version,source,effective_at AS "effectiveAt",expires_at AS "expiresAt" FROM iway_private.sop_articles WHERE tenant_id=$1 AND status=$2 AND approved_by IS NOT NULL AND approved_by<>authored_by AND (effective_at IS NULL OR effective_at<=now()) AND (expires_at IS NULL OR expires_at>now()) AND (allowed_roles IS NULL OR $3=ANY(allowed_roles))',
     [tenantId,'approved',role]);
    if(!Array.isArray(result.rows)||result.rows.some(r=>r.tenantId!==tenantId))throw Error('SOP_SCOPE_VIOLATION');
    return result.rows;
   }finally{client.release();}
  },
  async createTicketTransaction({tenantId,actorId,ticket}){
   if(!id(tenantId)||!id(actorId)||ticket?.tenantId!==tenantId||ticket?.requesterId!==actorId||ticket?.status!=='open')throw Error('SOP_TICKET_INVALID');
   return transaction(async client=>{
    const result=await client.query(
     'INSERT INTO iway_private.sop_tickets (tenant_id,requester_id,subject,priority,status) VALUES ($1,$2,$3,$4,$5) RETURNING id,tenant_id',
     [tenantId,actorId,ticket.subject,ticket.priority,'open']);
    if(result.rowCount!==1||result.rows[0]?.tenant_id!==tenantId||!id(String(result.rows[0]?.id??'')))throw Error('SOP_INSERT_UNVERIFIED');
    return {persisted:true,tenantId,ticketId:String(result.rows[0].id)};
   });
  },
  async transitionTicketTransaction({tenantId,actorId,ticketId,next,note=''}){
   if(!id(tenantId)||!id(actorId)||!id(ticketId)||!Object.hasOwn(transitions,next)||typeof note!=='string')throw Error('SOP_TRANSITION_INVALID');
   return transaction(async client=>{
    const current=await client.query('SELECT status FROM iway_private.sop_tickets WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[tenantId,ticketId]);
    if(current.rowCount!==1||!transitions[current.rows[0].status]?.includes(next))throw Error('SOP_TRANSITION_DENIED');
    const updated=await client.query('UPDATE iway_private.sop_tickets SET status=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2 AND status=$4 RETURNING id,tenant_id',[tenantId,ticketId,next,current.rows[0].status]);
    if(updated.rowCount!==1||updated.rows[0]?.tenant_id!==tenantId)throw Error('SOP_UPDATE_UNVERIFIED');
    await client.query('INSERT INTO iway_private.sop_ticket_events (tenant_id,ticket_id,actor_id,from_status,to_status,note) VALUES ($1,$2,$3,$4,$5,$6)',[tenantId,ticketId,actorId,current.rows[0].status,next,note.slice(0,500)]);
    return {persisted:true,tenantId,ticketId};
   });
  }
 };
}
