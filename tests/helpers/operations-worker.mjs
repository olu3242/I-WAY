import {OperationsStore} from '../../server/operations-store.mjs';
import {Operations} from '../../domain/operations.mjs';
const store=new OperationsStore(process.argv[2]);
try{new Operations(store).execute(process.argv[3],JSON.parse(process.argv[4]));console.log(JSON.stringify({ok:true}));}
catch(e){console.log(JSON.stringify({ok:false,code:e.code??'ERROR'}));}
finally{store.close()}
