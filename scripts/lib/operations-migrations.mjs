// Explicit pool only. Does not load environment files or choose a database.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export const operationsMigrationFiles=Object.freeze(['20261011174100_operations_persistence_readiness.sql','20261011210552_operations_active_principal_rls.sql','20261011220000_operations_actor_evidence.sql','20261011221000_operations_dispatcher_directory.sql']);
export async function applyOperationsMigrations(pool){
 const client=await pool.connect(),result={applied:[],skipped:[]};let locked=false;
 try{
  await client.query('SELECT pg_advisory_lock(187190)');locked=true;
  await client.query('CREATE SCHEMA IF NOT EXISTS operations_migrations; REVOKE ALL ON SCHEMA operations_migrations FROM PUBLIC; CREATE TABLE IF NOT EXISTS operations_migrations.applied(name text PRIMARY KEY, checksum text NOT NULL); REVOKE ALL ON operations_migrations.applied FROM PUBLIC');
  for(const name of operationsMigrationFiles){
   const sql=readFileSync(new URL('../../supabase/migrations/'+name,import.meta.url),'utf8').replaceAll('\r\n','\n'),checksum=createHash('sha256').update(sql).digest('hex');
   const prior=await client.query('SELECT checksum FROM operations_migrations.applied WHERE name=$1',[name]);
   if(prior.rowCount){if(prior.rows[0].checksum!==checksum)throw Error('MIGRATION_CHECKSUM_CHANGED');result.skipped.push(name);continue;}
   if(!/^BEGIN;$/m.test(sql)||!/COMMIT;\s*$/.test(sql))throw Error('MIGRATION_TRANSACTION_REQUIRED');
   const body=sql.replace(/^BEGIN;\s*$/m,'').replace(/COMMIT;\s*$/,'');
   await client.query('BEGIN');
   try{await client.query(body);await client.query('INSERT INTO operations_migrations.applied(name,checksum) VALUES($1,$2)',[name,checksum]);await client.query('COMMIT');result.applied.push(name)}catch(error){try{await client.query('ROLLBACK')}catch{}throw error}
  }
  return result;
 }finally{try{if(locked)await client.query('SELECT pg_advisory_unlock(187190)')}finally{client.release()}}
}
