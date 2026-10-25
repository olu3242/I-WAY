import {settlementIntegritySQL} from '../domain/operations-settlements.mjs';
import {invitationSQL} from './operations-invitations.mjs';
import {aiPolicyIntegritySQL} from '../domain/operations-ai-policy.mjs';
import{identitySQL}from'./operations-identity.mjs';
import{integrationIntegritySQL}from'../domain/operations-integration.mjs';
import{providerIntegritySQL}from'../domain/operations-provider.mjs';
import{complianceIntegritySQL}from'../domain/operations-compliance.mjs';
import {measurementIntegritySQL} from '../domain/operations-measurement.mjs';
import {intelligenceIntegritySQL} from '../domain/operations-intelligence.mjs';
import {runtimeIntegritySQL} from '../domain/operations-runtime.mjs';
import {documentIntegritySQL} from '../domain/operations-documents.mjs';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {OpsError} from '../domain/operations-errors.mjs';
export class OperationsStore{
 // Reuse seven fixed SQL statements only; always read current values and authority.
 #statements=new Map();
 #prepare(sql){let statement=this.#statements.get(sql);if(!statement){statement=this.db.prepare(sql);this.#statements.set(sql,statement)}return statement;}
 constructor(path,{onTransactionTiming}={}){
  if(onTransactionTiming!==undefined&&typeof onTransactionTiming!=='function')throw new TypeError('onTransactionTiming must be a function');
  this.onTransactionTiming=onTransactionTiming;
  mkdirSync(dirname(path),{recursive:true});
  this.db=new DatabaseSync(path);
  this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS tenants(id TEXT PRIMARY KEY,name TEXT NOT NULL,timezone TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),username TEXT UNIQUE NOT NULL,data TEXT NOT NULL,password TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),csrf TEXT NOT NULL,expires_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS resources(kind TEXT NOT NULL,id TEXT NOT NULL,tenant_id TEXT NOT NULL REFERENCES tenants(id),version INTEGER NOT NULL,data TEXT NOT NULL,
    PRIMARY KEY(kind,id),CHECK(json_extract(data,'$.tenantId')=tenant_id),CHECK(json_extract(data,'$.id')=id));
   CREATE INDEX IF NOT EXISTS resources_tenant ON resources(tenant_id,kind);
   CREATE UNIQUE INDEX IF NOT EXISTS active_load_assignment ON resources(tenant_id,json_extract(data,'$.loadId')) WHERE kind='assignment' AND json_extract(data,'$.status')='active';
   CREATE UNIQUE INDEX IF NOT EXISTS active_driver_assignment ON resources(tenant_id,json_extract(data,'$.driverId')) WHERE kind='assignment' AND json_extract(data,'$.status')='active';
   CREATE UNIQUE INDEX IF NOT EXISTS active_vehicle_assignment ON resources(tenant_id,json_extract(data,'$.vehicleId')) WHERE kind='assignment' AND json_extract(data,'$.status')='active';
   CREATE TABLE IF NOT EXISTS commands(tenant_id TEXT NOT NULL,actor_id TEXT NOT NULL,key TEXT NOT NULL,digest TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(tenant_id,actor_id,key));
   CREATE TABLE IF NOT EXISTS audit(sequence INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE NOT NULL,tenant_id TEXT NOT NULL,actor_id TEXT NOT NULL,action TEXT NOT NULL,resource_id TEXT,at TEXT NOT NULL,outcome TEXT NOT NULL,detail TEXT NOT NULL);
   CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit BEGIN SELECT RAISE(ABORT,'Audit is append only'); END;
   CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit BEGIN SELECT RAISE(ABORT,'Audit is append only'); END;
  `);
  this.db.exec(settlementIntegritySQL);
  this.db.exec(documentIntegritySQL);
  this.db.exec(intelligenceIntegritySQL);
  this.db.exec(runtimeIntegritySQL);
  this.db.exec(aiPolicyIntegritySQL);
  this.db.exec(measurementIntegritySQL);
  this.db.exec(complianceIntegritySQL);
  this.db.exec(identitySQL);
  this.db.exec(invitationSQL);
  this.db.exec(integrationIntegritySQL);
  this.db.exec(providerIntegritySQL);
 }
 transaction(fn){
  if(!this.onTransactionTiming){this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.db.exec('COMMIT');return result}catch(e){try{this.db.exec('ROLLBACK')}catch{}throw e}}
  const start=performance.now();let acquired=start,executed=start,finished=start,committed=false,began=false,bodyCompleted=false;
  try{
   this.db.exec('BEGIN IMMEDIATE');began=true;acquired=performance.now();
   const result=fn();executed=performance.now();bodyCompleted=true;
   this.db.exec('COMMIT');committed=true;finished=performance.now();return result;
  }catch(error){
   if(!began){acquired=performance.now();executed=acquired;}else if(!bodyCompleted)executed=performance.now();
   if(began){try{this.db.exec('ROLLBACK')}catch{ /* Preserve the original transaction failure. */ }}
   finished=began?performance.now():executed;throw error;
  }finally{
   // Never allow optional diagnostics to change transaction success or failure.
   try{this.onTransactionTiming({acquireMs:Math.max(0,acquired-start),executeMs:Math.max(0,executed-acquired),finalizeMs:Math.max(0,finished-executed),committed,acquired:began})}catch{}
  }
 }
 principal(id){const row=this.#prepare('SELECT data FROM users WHERE id=?').get(id);return row?JSON.parse(row.data):undefined}
 tenant(id){return this.#prepare('SELECT id,name,timezone FROM tenants WHERE id=?').get(id)}
 list(kind,tenantId){return this.#prepare('SELECT data FROM resources WHERE kind=? AND tenant_id=? ORDER BY rowid').all(kind,tenantId).map(r=>JSON.parse(r.data))}
 get(kind,id,tenantId){const row=this.#prepare('SELECT data FROM resources WHERE kind=? AND id=? AND tenant_id=?').get(kind,id,tenantId);if(!row)throw new OpsError(404,'NOT_FOUND','Record not found.');return JSON.parse(row.data)}
 insert(kind,tenantId,values){
  const doc={...values,kind,id:values.id??randomUUID(),tenantId,version:1};
  this.#prepare('INSERT INTO resources(kind,id,tenant_id,version,data) VALUES(?,?,?,?,?)').run(kind,doc.id,tenantId,1,JSON.stringify(doc));return doc;
 }
 update(kind,id,tenantId,expectedVersion,patch){
  const before=this.get(kind,id,tenantId);
  if(before.version!==expectedVersion)throw new OpsError(409,'STALE','This record changed. Refresh before retrying.');
  if(('id'in patch&&patch.id!==id)||('tenantId'in patch&&patch.tenantId!==tenantId)||('kind'in patch&&patch.kind!==kind))throw new OpsError(422,'OWNERSHIP','Record ownership cannot be overwritten.');
  const after={...before,...patch,id,kind,tenantId,version:before.version+1};
  const result=this.#prepare('UPDATE resources SET version=?,data=? WHERE kind=? AND id=? AND tenant_id=? AND version=?').run(after.version,JSON.stringify(after),kind,id,tenantId,expectedVersion);
  if(result.changes!==1)throw new OpsError(409,'STALE','This record changed.');
  return after;
 }
 audit(actor,action,resourceId,outcome,detail={},at=new Date().toISOString()){
  this.#prepare('INSERT INTO audit(id,tenant_id,actor_id,action,resource_id,at,outcome,detail) VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),actor.tenantId,actor.id,action,resourceId??null,at,outcome,JSON.stringify(detail));
 }
 close(){this.#statements.clear();this.db.close()}
}
