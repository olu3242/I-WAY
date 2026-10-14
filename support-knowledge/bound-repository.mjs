// B7: server-only, transaction-scoped SOP persistence. No browser-accessible DB credentials.
// The identity object must be issued by a trusted server-side verifier.
import {withSopTransaction,requireSopIdentity} from './transaction-context.mjs';
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9_.-]{1,100}$/.test(x);
const nextStates={open:['triaged'],triaged:['assigned'],assigned:['waiting_customer','resolved'],waiting_customer:['assigned'],resolved:['closed','assigned'],closed:[]};
export function createBoundSopRepository(pool,identity){
 const actor=requireSopIdentity(identity);
 const bound=({tenantId,actorId})=>{if(tenantId!==actor.tenantId||(actorId!==undefined&&actorId!==actor.actorId))throw Error('SOP_IDENTITY_MISMATCH')};
 const tx=run=>withSopTransaction(pool,identity,run);
 return {
  async listApprovedArticles({tenantId,role}){
   bound({tenantId});if(!valid(role)||role!==identity.role)throw Error('SOP_ROLE_MISMATCH');
   return tx(async client=>{
    const result=await client.query('SELECT id,tenant_id AS "tenantId",title,body,status,approved_by AS "approvedBy",authored_by AS "authoredBy",version,source,effective_at AS "effectiveAt",expires_at AS "expiresAt" FROM iway_private.sop_articles WHERE tenant_id=$1 AND status=$2 AND approved_by IS NOT NULL AND approved_by<>authored_by AND (effective_at IS NULL OR effective_at<=now()) AND (expires_at IS NULL OR expires_at>now()) AND (allowed_roles IS NULL OR $3=ANY(allowed_roles))',[tenantId,'approved',role]);
    if(!Array.isArray(result.rows)||result.rows.some(row=>row.tenantId!==tenantId))throw Error('SOP_SCOPE_VIOLATION');
    return result.rows;
   });
  },
  async createTicketTransaction({tenantId,actorId,ticket}){
   bound({tenantId,actorId});
   if(ticket?.tenantId!==tenantId||ticket?.requesterId!==actorId||ticket?.status!=='open')throw Error('SOP_TICKET_INVALID');
   return tx(async client=>{
    const result=await client.query('INSERT INTO iway_private.sop_tickets (tenant_id,requester_id,subject,priority,status) VALUES ($1,$2,$3,$4,$5) RETURNING id,tenant_id',[tenantId,actorId,ticket.subject,ticket.priority,'open']);
    if(result.rowCount!==1||result.rows[0]?.tenant_id!==tenantId||!valid(String(result.rows[0]?.id??'')))throw Error('SOP_INSERT_UNVERIFIED');
    return {persisted:true,tenantId,ticketId:String(result.rows[0].id)};
   });
  },
  async transitionTicketTransaction({tenantId,actorId,ticketId,next,note=''}){
   bound({tenantId,actorId});
   if(!valid(ticketId)||!Object.hasOwn(nextStates,next)||typeof note!=='string')throw Error('SOP_TRANSITION_INVALID');
   return tx(async client=>{
    const old=await client.query('SELECT status FROM iway_private.sop_tickets WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[tenantId,ticketId]);
    if(old.rowCount!==1||!nextStates[old.rows[0]?.status]?.includes(next))throw Error('SOP_TRANSITION_DENIED');
    const update=await client.query('UPDATE iway_private.sop_tickets SET status=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2 AND status=$4 RETURNING id,tenant_id',[tenantId,ticketId,next,old.rows[0].status]);
    if(update.rowCount!==1||update.rows[0]?.tenant_id!==tenantId)throw Error('SOP_UPDATE_UNVERIFIED');
    await client.query('INSERT INTO iway_private.sop_ticket_events (tenant_id,ticket_id,actor_id,from_status,to_status,note) VALUES ($1,$2,$3,$4,$5,$6)',[tenantId,ticketId,actorId,old.rows[0].status,next,note.slice(0,500)]);
    return {persisted:true,tenantId,ticketId};
   });
  }
 };
}
