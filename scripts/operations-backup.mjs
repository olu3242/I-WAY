import {backupOperations,RecoveryError} from '../server/operations-recovery.mjs';
const [sourcePath,backupDirectory,...extra]=process.argv.slice(2);
try{
 if(!sourcePath||!backupDirectory||extra.length)throw new RecoveryError('USAGE','Usage: node scripts/operations-backup.mjs SOURCE_DATABASE NEW_BACKUP_DIRECTORY');
 console.log(JSON.stringify(await backupOperations({sourcePath,backupDirectory})));
}catch(error){console.error(JSON.stringify({status:'FAIL',code:error instanceof RecoveryError?error.code:'BACKUP_FAILED',error:error instanceof RecoveryError?error.message:'Local backup could not complete.'}));process.exitCode=1;}
