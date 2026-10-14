import {restoreOperations,RecoveryError} from '../server/operations-recovery.mjs';
const [backupDirectory,targetDirectory,expectedManifestSha256,...extra]=process.argv.slice(2);
try{
 if(!backupDirectory||!targetDirectory||!expectedManifestSha256||extra.length)throw new RecoveryError('USAGE','Usage: node scripts/operations-restore.mjs BACKUP_DIRECTORY NEW_RESTORE_DIRECTORY TRUSTED_MANIFEST_SHA256');
 console.log(JSON.stringify(await restoreOperations({backupDirectory,targetDirectory,expectedManifestSha256})));
}catch(error){console.error(JSON.stringify({status:'FAIL',code:error instanceof RecoveryError?error.code:'RESTORE_FAILED',error:error instanceof RecoveryError?error.message:'Local restore could not complete.'}));process.exitCode=1;}
