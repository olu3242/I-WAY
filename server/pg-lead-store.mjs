import {randomUUID,createHash} from 'node:crypto';
import {normalizeLead} from './lead-store.mjs';
/** Private-schema insert; connection must use a server-only, least-privileged database role. */
export async function registerPgLead(pool,input,{consentVersion}={}){
 const lead=normalizeLead(input);
 if(!consentVersion || !/^[a-zA-Z0-9._-]{1,30}$/.test(consentVersion)) throw new Error('Registration unavailable: approved consent version not configured');
 const emailHash=createHash('sha256').update(lead.email).digest('hex');
 const result=await pool.query(
  `INSERT INTO iway_private.early_access_leads
    (id,name,email,email_hash,company,role,consent,consent_version,created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
    ON CONFLICT (email_hash) DO NOTHING RETURNING id`,
  [randomUUID(),lead.name,lead.email,emailHash,lead.company,lead.role,true,consentVersion]
 );
 return {created:result.rowCount===1};
}
