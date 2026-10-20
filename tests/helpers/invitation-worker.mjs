import {workerData,parentPort} from 'node:worker_threads';
import {OperationsStore} from '../../server/operations-store.mjs';
import {createIdentityVerifier} from '../../server/operations-identity.mjs';
import {createInvitationService} from '../../server/operations-invitations.mjs';
const d=workerData,store=new OperationsStore(d.path);
const verifier=createIdentityVerifier({issuer:d.issuer,audience:'iway-fixture',keys:[{kid:'fixture',algorithm:'ES256',publicKey:d.publicKey}]});
parentPort.postMessage('ready');Atomics.wait(new Int32Array(d.gate),0,0);
try{const result=createInvitationService(store,{verifier}).accept(d.token,d.identityToken);parentPort.postMessage({state:result.state});}
catch(e){parentPort.postMessage({code:e.code??'UNEXPECTED'});}
finally{store.close();}
