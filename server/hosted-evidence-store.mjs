import {DatabaseSync} from 'node:sqlite';
import {lstatSync,realpathSync,openSync,closeSync,fstatSync,readFileSync,constants} from 'node:fs';
import {resolve,relative,sep,dirname} from 'node:path';
import {canonical,digest,exact,validateRecord,validateArtifact,verifyEnvelope,verifyAuthorization,lifecycle} from '../domain/hosted-evidence.mjs';

export function safeRead(root,name){
 if(typeof name!=='string'||name.length>180||name.includes('\\')||name.split('/').some(p=>!p||p==='.'||p==='..')||/[:\x00-\x1f]/.test(name))throw Error('UNSAFE_PATH');
 const base=resolve(root),target=resolve(base,name),rel=relative(base,target);
 if(!rel||rel.startsWith('..')||resolve(base)!==realpathSync(base))throw Error('UNSAFE_PATH');
 for(let p=target;;p=dirname(p)){
  if(lstatSync(p).isSymbolicLink())throw Error('SYMLINK_REJECTED');
  if(p===base)break;if(p===dirname(p))throw Error('UNSAFE_PATH');
 }
 if(!realpathSync(target).startsWith(base+sep))throw Error('UNSAFE_PATH');
 const fd=openSync(target,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
 try{const before=fstatSync(fd);if(!before.isFile()||before.size>262144||before.nlink!==1)throw Error('ARTIFACT_SIZE_OR_LINK_INVALID');const raw=readFileSync(fd);const after=fstatSync(fd),pathStat=lstatSync(target);if(before.ino!==after.ino||before.size!==after.size||before.mtimeMs!==after.mtimeMs||raw.length>262144||pathStat.isSymbolicLink()||pathStat.ino!==after.ino||pathStat.dev!==after.dev||realpathSync(target)!==target)throw Error('ARTIFACT_CHANGED');return raw}finally{closeSync(fd)}
}
const zero='0'.repeat(64);
const requestKeys=['recordId','recordDigest','from','to','revision','at','requestId','authorizationRef'];
// Store and artifact roots must be owned by the service account. Not an untrusted upload directory.
export class HostedEvidenceStore{
 constructor({database,artifactRoot,policy,binding,now=()=>new Date().toISOString()}){
  this.root=artifactRoot;this.policy=policy;this.binding=Object.freeze({...binding});this.now=now;
  if(database!==':memory:'){
   if(resolve(dirname(database))!==realpathSync(dirname(database)))throw Error('UNSAFE_STORE_PATH');
   for(const suffix of ['','-wal','-shm','-journal'])try{const stat=lstatSync(database+suffix);if(stat.isSymbolicLink()||!stat.isFile()||stat.nlink!==1)throw Error('UNSAFE_STORE_PATH')}catch(e){if(e.code!=='ENOENT')throw e}
  }
  this.db=new DatabaseSync(database);this.db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS hosted_evidence_events (sequence INTEGER PRIMARY KEY AUTOINCREMENT, record_id TEXT NOT NULL, revision INTEGER NOT NULL, request_id TEXT NOT NULL UNIQUE, envelope TEXT NOT NULL, record TEXT, previous_hash TEXT NOT NULL, event_hash TEXT NOT NULL, UNIQUE(record_id,revision));');
 }
 close(){this.db.close()}
 artifact(record){return validateArtifact(record,safeRead(this.root,record.artifact.path))}
 history(id){
  const rows=this.db.prepare('SELECT * FROM hosted_evidence_events WHERE record_id=? ORDER BY revision').all(id);
  if(!rows.length)throw Error('EVIDENCE_NOT_FOUND');
  let prev=zero,state=null,record,reviewer=null,approvalAt=null;
  for(let i=0;i<rows.length;i++){
   const row=rows[i],envelope=JSON.parse(row.envelope),p=envelope.payload;
   exact(p,requestKeys);
   if(i===0)record=JSON.parse(row.record);
   else if(row.record!==null)throw Error('AUDIT_TAMPERED');
   if(record.tenant!==this.binding.tenant||record.environment!==this.binding.environment)throw Error('EVIDENCE_NOT_FOUND');
   if(row.revision!==i||p.revision!==i||row.request_id!==p.requestId||p.recordId!==id||p.recordDigest!==digest(canonical(record))||p.authorizationRef!==record.authorizationRef||p.from!==state||p.to===(state??'NONE')||p.at<record.collectedAt||i>0&&p.at<JSON.parse(rows[i-1].envelope).payload.at||row.previous_hash!==prev||row.event_hash!==digest(canonical({envelope,record:i===0?record:null,previousHash:prev})))throw Error('AUDIT_TAMPERED');
   if(i===0?p.to!=='DRAFT':!lifecycle[state]?.includes(p.to))throw Error('LIFECYCLE_INVALID');
   const key=verifyEnvelope(envelope,this.policy,{purpose:'transition:'+p.to,tenant:record.tenant,environment:record.environment,at:p.at});
   if(!key.subjectId||i===0&&key.subjectId!==record.collector||['REVIEWED','ACCEPTED'].includes(p.to)&&key.subjectId===record.collector)throw Error('INDEPENDENT_REVIEW_REQUIRED');
   if(p.to==='REVIEWED')reviewer=key.subjectId;
   if(p.to==='ACCEPTED'){if(!reviewer)throw Error('INDEPENDENT_REVIEW_REQUIRED');approvalAt=p.at}
   prev=row.event_hash;state=p.to;
  }
  return {record,state,revision:rows.length-1,reviewer,approvalAt,auditHead:prev};
 }
 inspect(id){
  const item=this.history(id),now=this.now();
  validateRecord(item.record,this.binding,item.record.collectedAt);this.artifact(item.record);
  if(item.record.expiresAt<=now)item.effectiveState='EXPIRED';
  else if(this.policy.revokedAuthorizations?.includes(item.record.authorizationRef))item.effectiveState='REVOKED';
  else item.effectiveState=item.state;
  return item;
 }
 apply({record,envelope,authorization}){
  exact(envelope,['keyId','payload','signature']);const p=envelope.payload;exact(p,requestKeys);
  if(typeof p.requestId!=='string'||!/^[A-Za-z0-9_.-]{1,80}$/.test(p.requestId)||!Number.isSafeInteger(p.revision)||p.revision<0)throw Error('REQUEST_INVALID');
  const now=this.now();if(!Number.isFinite(Date.parse(p.at))||new Date(p.at).toISOString()!==p.at||p.at>now||Date.parse(now)-Date.parse(p.at)>300000)throw Error('STALE_REQUEST');
  this.db.exec('BEGIN IMMEDIATE');
  try{
   const duplicate=this.db.prepare('SELECT envelope,record_id FROM hosted_evidence_events WHERE request_id=?').get(p.requestId);
   if(duplicate){if(duplicate.envelope!==canonical(envelope))throw Error('IDEMPOTENCY_CONFLICT');const current=this.inspect(duplicate.record_id);this.db.exec('COMMIT');return current}
   let current=null;
   if(p.revision===0){if(p.from!==null||p.to!=='DRAFT'||!record)throw Error('LIFECYCLE_INVALID');validateRecord(record,this.binding,now)}
   else{current=this.inspect(p.recordId);if(current.revision+1!==p.revision||p.from!==current.state)throw Error('STALE_REVISION');record=current.record;if(!lifecycle[current.state]?.includes(p.to))throw Error('LIFECYCLE_INVALID');}
   if(p.recordId!==record.id||p.recordDigest!==digest(canonical(record))||p.authorizationRef!==record.authorizationRef)throw Error('REQUEST_BINDING_INVALID');
   const key=verifyEnvelope(envelope,this.policy,{purpose:'transition:'+p.to,tenant:record.tenant,environment:record.environment,at:now});
   if(!key.subjectId||p.to==='DRAFT'&&key.subjectId!==record.collector||['REVIEWED','ACCEPTED'].includes(p.to)&&key.subjectId===record.collector)throw Error('INDEPENDENT_REVIEW_REQUIRED');
   if(p.to==='EXPIRED'){if(record.expiresAt>now)throw Error('NOT_EXPIRED')}
   else if(!['REVOKED','REJECTED'].includes(p.to)){
    validateRecord(record,this.binding,now);this.artifact(record);
    if(p.to!=='DRAFT'){
     const grant=verifyAuthorization(authorization,this.policy,this.binding,now);
     if(grant.id!==record.authorizationRef||record.scenario&&!grant.scenarios.includes(record.scenario))throw Error('AUTHORIZATION_SCOPE_INVALID');
    }
    if(['REVIEWED','ACCEPTED'].includes(p.to)&&record.result!=='PASS')throw Error('FAILED_EVIDENCE');
    if(p.to==='ACCEPTED'&&!current.reviewer)throw Error('INDEPENDENT_REVIEW_REQUIRED');
   }
   if(p.to==='DRAFT'&&this.db.prepare('SELECT 1 FROM hosted_evidence_events WHERE record_id=?').get(record.id))throw Error('DUPLICATE_EVIDENCE');
   if(p.to==='DRAFT')for(const row of this.db.prepare('SELECT record FROM hosted_evidence_events WHERE revision=0').all()){
    const other=JSON.parse(row.record);if(other.provenance.runId===record.provenance.runId&&other.scenario===record.scenario||other.artifact.sha256===record.artifact.sha256)throw Error('REPLAYED_EVIDENCE');
   }
   const previousHash=current?.auditHead??zero;
   const eventHash=digest(canonical({envelope,record:p.revision===0?record:null,previousHash}));
   this.db.prepare('INSERT INTO hosted_evidence_events(record_id,revision,request_id,envelope,record,previous_hash,event_hash) VALUES(?,?,?,?,?,?,?)').run(record.id,p.revision,p.requestId,canonical(envelope),p.revision===0?canonical(record):null,previousHash,eventHash);
   const result=this.inspect(record.id);this.db.exec('COMMIT');return result;
  }catch(e){this.db.exec('ROLLBACK');throw e}
 }
 reconcile(){return this.db.prepare('SELECT record_id FROM hosted_evidence_events WHERE revision=0 ORDER BY record_id').all().map(row=>this.inspect(row.record_id))}
}
