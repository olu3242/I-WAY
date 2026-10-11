import {OperationsStore} from '../server/operations-store.mjs';
import {bootstrap} from '../server/operations-auth.mjs';
const args=process.argv.slice(2);
if(args.length!==3){console.error('Usage: npm run ops:init -- <username> <display-name> <tenant-name>\nSupply a 12+ character local account password through standard input. No Supabase environment is loaded.');process.exit(1);}
let password='';for await(const part of process.stdin){password+=part;if(password.length>300){console.error('Invalid password input.');process.exit(1);}}
const store=new OperationsStore(process.env.IWAY_OPS_DB??'data/operations.sqlite');
try{bootstrap(store,{username:args[0],name:args[1],tenantName:args[2],timezone:'America/Chicago',password:password.replace(/\r?\n$/,'')});console.log('Local workspace initialized. Sign in at the local operations app.');}
catch{console.error('Initialization failed. Check inputs or whether this workspace already exists.');process.exitCode=1;}
finally{password='';store.close();}
