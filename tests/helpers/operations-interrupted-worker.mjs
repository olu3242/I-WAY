import {DatabaseSync} from 'node:sqlite';
const db=new DatabaseSync(process.argv[2]);db.exec('PRAGMA busy_timeout=5000; BEGIN IMMEDIATE; UPDATE interruption_probe SET value=1');
process.send('uncommitted');setInterval(()=>{},1000);
