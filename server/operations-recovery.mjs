import {DatabaseSync,backup} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,lstat,realpath,readFile,writeFile,copyFile,chmod} from 'node:fs/promises';
import {createReadStream,constants} from 'node:fs';
import {resolve,dirname,join,basename} from 'node:path';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';

export class RecoveryError extends Error{constructor(code,message){super(message);this.name='RecoveryError';this.code=code;}}
const fail=(code,message)=>{throw new RecoveryError(code,message)};
const guard=(condition,code,message)=>{if(!condition)fail(code,message)};
const digest=value=>createHash('sha256').update(value).digest('hex');
const tables=['tenants','users','sessions','resources','commands','audit'];
const iso=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
async function fileHash(path){const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex');}
async function rejectLinkedParents(path){
 let current=resolve(path);while(true){const metadata=await lstat(current);guard(metadata.isDirectory()&&!metadata.isSymbolicLink(),'SOURCE_LINK','Symbolic-link directory paths are not supported.');const parent=dirname(current);if(parent===current)break;current=parent;}
}
async function plainDirectory(path){const absolute=resolve(path);await rejectLinkedParents(absolute);return realpath(absolute);}
async function plainFile(path){
 const absolute=resolve(path),metadata=await lstat(absolute);
 guard(metadata.isFile()&&!metadata.isSymbolicLink(),'SOURCE_TYPE','Use a regular local database or manifest file.');
 await rejectLinkedParents(dirname(absolute));return realpath(absolute);
}
async function privateNewDirectory(path){
 const requested=resolve(path),parent=await plainDirectory(dirname(requested)),absolute=join(parent,basename(requested));
 guard(!/[\\/]site(?:[\\/]|$)|[\\/]\.git(?:[\\/]|$)/i.test(absolute),'PUBLIC_TARGET','Operational backup artifacts must stay outside public site and Git metadata directories.');
 // mkdir is deliberately exclusive; an existing destination, including a symlink, is never reused.
 try{await mkdir(absolute,{mode:0o700})}catch{fail('TARGET_EXISTS','Destination must be a new directory under an existing parent.');}
 if(process.platform==='win32'){
  try{
   const sid=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{windowsHide:true,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
   guard(/^S-\d+(?:-\d+)+$/.test(sid),'TARGET_ACL','Cannot establish restricted backup permissions.');
   execFileSync('icacls.exe',[absolute,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','*S-1-5-32-544:(OI)(CI)F'],{windowsHide:true,stdio:'ignore'});
  }catch{fail('TARGET_ACL','Cannot establish restricted backup permissions. No database copy was started.');}
 }else await chmod(absolute,0o700);
 return absolute;
}
function inspect(db){
 const integrity=db.prepare('PRAGMA integrity_check').all();
 guard(integrity.length===1&&Object.values(integrity[0])[0]==='ok','INTEGRITY','SQLite integrity verification failed.');
 guard(db.prepare('PRAGMA foreign_key_check').all().length===0,'FOREIGN_KEYS','SQLite relationship verification failed.');
 const schema=db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
 const names=new Set(schema.filter(r=>r.type==='table').map(r=>r.name));
 guard(tables.every(name=>names.has(name)),'SCHEMA','This is not a supported I-way operations store.');
 guard(['audit_no_update','audit_no_delete'].every(name=>schema.some(r=>r.type==='trigger'&&r.name===name)),'SCHEMA','Required audit immutability controls are missing.');
 const counts=Object.fromEntries(tables.map(name=>[name,db.prepare('SELECT count(*) AS count FROM '+name).get().count]));
 const last=db.prepare('SELECT sequence,at FROM audit ORDER BY sequence DESC LIMIT 1').get();
 return {integrity:'ok',foreignKeyViolations:0,schemaSha256:digest(JSON.stringify(schema)),counts,auditSequence:last?.sequence??0,lastAuditAt:last?.at??null};
}
function readInspection(path){
 let db;try{db=new DatabaseSync(path,{readOnly:true,defensive:true,timeout:5000});return inspect(db)}finally{db?.close()}
}
function manifestShape(value){
 guard(value&&value.format==='iway-operations-backup'&&value.version===1&&value.databaseFile==='operations.sqlite'&&value.hashAlgorithm==='sha256','MANIFEST','Backup manifest format is unsupported.');
 guard(/^[a-f0-9]{64}$/.test(value.databaseSha256)&&Number.isSafeInteger(value.databaseBytes)&&value.databaseBytes>0&&iso(value.snapshotStartedAt)&&iso(value.snapshotCompletedAt),'MANIFEST','Backup manifest fields are invalid.');
 guard(value.inspection?.integrity==='ok'&&value.inspection.foreignKeyViolations===0&&Number.isSafeInteger(value.inspection.auditSequence),'MANIFEST','Backup manifest integrity evidence is missing.');
 return value;
}
export async function backupOperations({sourcePath,backupDirectory,pagesPerStep=100,onProgress}){
 guard(typeof sourcePath==='string'&&typeof backupDirectory==='string','PATH','Explicit source and new backup directory are required.');
 guard(Number.isSafeInteger(pagesPerStep)&&pagesPerStep>0&&pagesPerStep<=1000,'BACKUP_RATE','Invalid backup page batch size.');
 const source=await plainFile(sourcePath),directory=await privateNewDirectory(backupDirectory),destination=join(directory,'operations.sqlite');
 let db;const started=performance.now(),snapshotStartedAt=new Date().toISOString();
 try{
  db=new DatabaseSync(source,{readOnly:true,defensive:true,timeout:5000});inspect(db);
  const totalPages=await backup(db,destination,{rate:pagesPerStep,progress:onProgress?value=>onProgress({totalPages:value.totalPages,remainingPages:value.remainingPages}):undefined});
  db.close();db=null;
  await chmod(destination,0o600);
  const inspection=readInspection(destination),snapshotCompletedAt=new Date().toISOString(),metadata=await lstat(destination);
  const manifest={format:'iway-operations-backup',version:1,backupId:randomUUID(),databaseFile:'operations.sqlite',hashAlgorithm:'sha256',databaseSha256:await fileHash(destination),databaseBytes:metadata.size,totalPages,
   snapshotStartedAt,snapshotCompletedAt,inspection,scope:'local SQLite only; hosted backup certification blocked',confidentiality:'Private filesystem ACLs; backup is not application-encrypted'};
  const contents=JSON.stringify(manifest,null,2)+'\n';await writeFile(join(directory,'manifest.json'),contents,{flag:'wx',mode:0o600});
  return {status:'PASS',manifestSha256:digest(contents),backupDurationMs:performance.now()-started,databaseBytes:metadata.size,totalPages,snapshotStartedAt,snapshotCompletedAt,auditSequence:inspection.auditSequence,lastRecoverableAuditAt:inspection.lastAuditAt,integrity:'ok',hostedCertified:false};
 }catch(error){if(error instanceof RecoveryError)throw error;fail('BACKUP_FAILED','Backup did not complete; the new destination is incomplete and must not be used.');}
 finally{db?.close()}
}
export async function restoreOperations({backupDirectory,targetDirectory,expectedManifestSha256}){
 guard(typeof backupDirectory==='string'&&typeof targetDirectory==='string','PATH','Explicit backup and new restore directories are required.');
 guard(typeof expectedManifestSha256==='string'&&/^[a-f0-9]{64}$/.test(expectedManifestSha256),'TRUSTED_DIGEST','Provide the manifest SHA-256 retained separately when the backup was created.');
 const started=performance.now(),directory=await plainDirectory(backupDirectory),manifestPath=await plainFile(join(directory,'manifest.json'));
 const manifestBytes=await readFile(manifestPath);guard(manifestBytes.length<=65536,'MANIFEST','Backup manifest is too large.');
 guard(digest(manifestBytes)===expectedManifestSha256,'MANIFEST_HASH','Backup manifest does not match the separately retained trusted digest.');
 let manifest;try{manifest=manifestShape(JSON.parse(manifestBytes.toString('utf8')))}catch(error){if(error instanceof RecoveryError)throw error;fail('MANIFEST','Backup manifest cannot be parsed.');}
 const source=await plainFile(join(directory,manifest.databaseFile)),sourceMetadata=await lstat(source);
 guard(sourceMetadata.size===manifest.databaseBytes&&await fileHash(source)===manifest.databaseSha256,'DATABASE_HASH','Backup database does not match its verified manifest.');
 const inspection=readInspection(source);
 guard(JSON.stringify(inspection)===JSON.stringify(manifest.inspection),'SNAPSHOT','Backup schema or recovery-point evidence differs from its manifest.');
 const destinationDirectory=await privateNewDirectory(targetDirectory),destination=join(destinationDirectory,'operations.sqlite');
 try{
  await copyFile(source,destination,constants.COPYFILE_EXCL);await chmod(destination,0o600);
  guard(await fileHash(destination)===manifest.databaseSha256,'RESTORE_HASH','The restored copy failed checksum verification.');
  const db=new DatabaseSync(destination,{defensive:true,timeout:5000});
  let sessionsRevoked=0;
  try{
   inspect(db);db.exec('BEGIN IMMEDIATE');
   try{
    sessionsRevoked=db.prepare('DELETE FROM sessions').run().changes;
    const restoredAt=new Date().toISOString();
    for(const tenant of db.prepare('SELECT id FROM tenants').all())db.prepare('INSERT INTO audit(id,tenant_id,actor_id,action,resource_id,at,outcome,detail) VALUES(?,?,?,?,?,?,?,?)')
     .run(randomUUID(),tenant.id,'local-recovery-service','recovery:restore',manifest.backupId,restoredAt,'success',JSON.stringify({manifestSha256:expectedManifestSha256,snapshotAuditSequence:manifest.inspection.auditSequence,priorSessionsRevoked:true,localOnly:true}));
    db.exec('COMMIT');
   }catch{db.exec('ROLLBACK');throw new Error('Restore initialization failed')}
   inspect(db);
  }finally{db.close()}
  const restoredAt=new Date().toISOString();
  return {status:'PASS',restoreDurationMs:performance.now()-started,restoredAt,sourceManifestSha256:expectedManifestSha256,snapshotCompletedAt:manifest.snapshotCompletedAt,lastRecoverableAuditAt:manifest.inspection.lastAuditAt,recoveredAuditSequence:manifest.inspection.auditSequence,snapshotAgeMs:Date.parse(restoredAt)-Date.parse(manifest.snapshotCompletedAt),sessionsRevoked,integrity:'ok',hostedCertified:false};
 }catch(error){if(error instanceof RecoveryError)throw error;fail('RESTORE_FAILED','Restore did not complete; the new destination is incomplete and must not be started.');}
}
