import {spawn} from 'node:child_process';
import {certificationConfig} from './pg-certification-config.mjs';
const mode=process.argv[2];
try{certificationConfig(mode)}catch(e){console.error('NO-GO: '+e.message);process.exit(1)}
console.log(mode==='hosted'?'Running hosted PostgreSQL certification':'Running LOCAL PostgreSQL checks; this cannot certify hosted operation');
const child=spawn(process.execPath,['--test','tests/hosted/postgres.test.mjs'],{
 stdio:'inherit',env:{...process.env,IWAY_PG_TEST_MODE:mode}
});
child.on('error',()=>{console.error('NO-GO: test process could not start');process.exitCode=1});
child.on('exit',code=>{process.exitCode=code===0?0:1;if(code!==0)console.error('NO-GO: PostgreSQL certification failed')});
