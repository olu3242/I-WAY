// B410: two independent PostgreSQL sessions race to issue the same invitation nonce.
// Disposable fixture only; never use production credentials.
import {Client} from 'pg';
import {createPgNonceChallenges} from '../server/operations-pg-nonce-challenges.experimental.mjs';
import {randomUUID} from 'node:crypto';
const invitationId=randomUUID(),tenantId=randomUUID(),actorId=randomUUID();
const clients=[new Client(),new Client(),new Client()];
for(const client of clients)await client.connect();
const transaction=client=>async fn=>{
 await client.query('BEGIN');
 try{const result=await fn(client);await client.query('COMMIT');return result;}
 catch(error){await client.query('ROLLBACK');throw error;}
};
try{
 await clients[0].query(`INSERT INTO operations_onboarding.invitations
  (id,tenant_id,creator_id,recipient,assignment,issuer,subject_hash,state,expires_at)
  VALUES($1,$2,$3,$4,'{"role":"driver"}','https://fixture.invalid',$5,'VERIFIED',now()+interval '1 hour')`,
  [invitationId,tenantId,actorId,invitationId+'@example.invalid','f'.repeat(64)]);
 const results=await Promise.allSettled(clients.slice(1).map(client=>
  createPgNonceChallenges(transaction(client)).issue({invitationId,tenantId})));
 const fulfilled=results.filter(r=>r.status==='fulfilled');
 const rejected=results.filter(r=>r.status==='rejected');
 if(fulfilled.length!==1||rejected.length!==1)throw Error('B410_CONCURRENT_NONCE_ISSUANCE_NOT_SERIALIZED');
 const count=await clients[0].query(`SELECT count(*)::int AS n
  FROM operations_onboarding.identity_nonce_challenges
  WHERE invitation_id=$1 AND consumed_at IS NULL`,[invitationId]);
 if(count.rows[0].n!==1)throw Error('B410_DUPLICATE_ACTIVE_NONCES');
 const invalidTenant=await Promise.allSettled([createPgNonceChallenges(transaction(clients[1])).issue({invitationId,tenantId:randomUUID()})]);
 if(invalidTenant[0].status!=='rejected')throw Error('B410_CROSS_TENANT_NONCE_ALLOWED');
 console.log('PASS: B410 two-session nonce race yields one winner, one rejection, one active challenge');
}finally{
 for(const client of clients)await client.end();
}
