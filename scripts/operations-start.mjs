import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {OperationsStore} from '../server/operations-store.mjs';
import {createOperationsFeatures,runFeatureTick} from '../domain/operations-features.mjs';
import {Operations} from '../domain/operations.mjs';
import {makeOperationsApp} from '../server/operations-app.mjs';

// Dependencies are injectable only through this server module, never through HTTP or persisted job payloads.
export async function startLocalOperations({databasePath,port=4180,intervalMs=1000,runTick=runFeatureTick,logger=console}){
 if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid local operations port');
 if(!Number.isInteger(intervalMs)||intervalMs<10||intervalMs>60000)throw new Error('Invalid local checkpoint interval');
 if(typeof databasePath!=='string'||!databasePath)throw new Error('A local operations database path is required');
 const store=new OperationsStore(resolve(databasePath));
 const operations=new Operations(store,createOperationsFeatures()),server=makeOperationsApp({store,operations,logSink:event=>logger.info?.(JSON.stringify(event))});
 let currentTick=null,stopping=false,worker=null,shutdownPromise=null;
 const triggerTick=()=>{
  if(stopping||currentTick)return;
  currentTick=Promise.resolve().then(()=>runTick(operations))
   .catch(()=>logger.error('Local workflow checkpoint deferred; no partial write committed.'))
   .finally(()=>{currentTick=null});
 };
 const shutdown=()=>{
  if(shutdownPromise)return shutdownPromise;
  stopping=true;clearInterval(worker);
  const inFlight=currentTick??Promise.resolve();
  const httpClosed=new Promise((accept,reject)=>server.close(error=>error&&error.code!=='ERR_SERVER_NOT_RUNNING'?reject(error):accept()));
  server.closeIdleConnections();
  shutdownPromise=(async()=>{
   // Adapters enforce their own timeouts. Keep persistence open until the captured checkpoint has finished.
   const results=await Promise.allSettled([httpClosed,inFlight]);
   store.close();
   const failed=results.find(result=>result.status==='rejected');
   if(failed)throw new Error('Local operations shutdown did not complete cleanly');
  })();
  return shutdownPromise;
 };
 try{
  await new Promise((accept,reject)=>{
   const onError=error=>reject(error);server.once('error',onError);
   server.listen(port,'127.0.0.1',()=>{server.off('error',onError);accept()});
  });
 }catch{
  store.close();throw new Error('Local operations server could not listen');
 }
 worker=setInterval(triggerTick,intervalMs);
 return {server,store,operations,shutdown};
}
async function main(){
 const app=await startLocalOperations({databasePath:process.env.IWAY_OPS_DB??'data/operations.sqlite',port:Number(process.env.IWAY_OPS_PORT??4180)});
 console.log('I-way local operations: http://127.0.0.1:'+app.server.address().port+' (not hosted-certified)');
 const stop=()=>{app.shutdown().then(()=>process.exit(0),()=>{console.error('Local operations shutdown failed');process.exit(1)})};
 for(const signal of ['SIGTERM','SIGINT'])process.on(signal,stop);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 main().catch(()=>{console.error('Local operations startup failed');process.exitCode=1});
}
