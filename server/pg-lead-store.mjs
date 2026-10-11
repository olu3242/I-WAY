import {randomUUID,createHash} from 'node:crypto';
import {normalizeLead} from './lead-store.mjs';
/** Dependency-injected pg Pool; parameterized SQL and database-enforced deduplication. */
export async function registerPgLead(pool,input){
 const lead=normalizeLead(input);
 const emailHash=createHash('sha256').update(lead.email).digest('hex');
 const result=await pool.query(
  `INSERT INTO early_access_leads (id,name,email,email_hash,company,role,consent,created_at)
   VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
   ON CONFLICT (email_hash) DO NOTHING RETURNING id`,
  [randomUUID(),lead.name,lead.email,emailHash,lead.company,lead.role,true]
 );
 return {created:result.rowCount===1};
}
