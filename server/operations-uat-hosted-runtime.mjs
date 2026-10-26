// Isolated Preview assembly. No schema creation, seeded principals, email delivery or admin credentials.
import {resolveUatRuntimeConfig,createUatCandidateRuntime} from './operations-uat-runtime.mjs';
import {buildOperationsPgConfig} from './operations-postgres.mjs';
import {DurableOperationsPgEngine} from './operations-durable-postgres.mjs';
import {createDurableUatApplication} from './operations-durable-uat.mjs';
import {loadHostedUatBindings} from './operations-uat-hosted-bindings.mjs';
import {loadHostedUatVerifier} from './operations-uat-jwks.mjs';
export function resolveHostedOperationsConfig(env){
 resolveUatRuntimeConfig(env); // Genuine Preview/project gates precede every database connection.
 let url;try{url=new URL(env.IWAY_OPERATIONS_DATABASE_URL);}catch{throw Error('UAT_OPERATIONS_DATABASE_REQUIRED');}
 try{return buildOperationsPgConfig({databaseUrl:env.IWAY_OPERATIONS_DATABASE_URL,projectRef:'vnoxdinldneeczxibicp',endpoint:url.hostname,databaseName:'postgres',loginRole:'iway_operations_runtime'});}catch{throw Error('UAT_OPERATIONS_DATABASE_REJECTED');}
}
export async function createHostedUatRuntime({env=process.env,PoolClass,fetchImpl=fetch,clock=()=>Date.now()}={}){
 const config=resolveHostedOperationsConfig(env),Pool=PoolClass??(await import('pg')).Pool;
 const pool=new Pool(config);pool.on('error',()=>{});
 let candidate;
 try{
  const engine=new DurableOperationsPgEngine({pool,config});await engine.health();
  const bindings=await loadHostedUatBindings({pool});if(!await engine.validatePlatformNamespace(bindings.platformNamespaceId))throw Error();
  for(const entry of bindings.roster)if(!await engine.verifyUatEntry(entry,bindings.platformNamespaceId))throw Error();
  for(const profile of bindings.ownerProfiles??[])if(!await engine.verifyUatEntry({...profile,tenantId:profile.role==='platform'?null:profile.tenantId},bindings.platformNamespaceId))throw Error();
  const verifier=await loadHostedUatVerifier({fetchImpl}),keysExpireAt=clock()+300000;
  const denyIssuance=async()=>{throw Error('UAT_HOSTED_ISSUANCE_NOT_AUTHORIZED');};
  candidate=await createUatCandidateRuntime({env,PoolClass:Pool,fetchImpl,verifier,roster:bindings.roster,ownerUserIds:[...new Set((bindings.ownerProfiles??[]).map(p=>p.ownerUserId))],
   authenticateAdministrator:denyIssuance,authorizeIssuance:async()=>false,issuer:{generateRecovery:denyIssuance},deliver:denyIssuance,
   verifyRelationships:entry=>engine.verifyUatEntry(entry,bindings.platformNamespaceId),
   controlPlaneMembership:async userId=>{
    const entry=bindings.roster.find(item=>item.role==='platform'&&item.userId===userId);
    return entry?{...entry,active:true,revoked:false,tenantActive:true}:null;
   },
   application:async dependencies=>createDurableUatApplication({...dependencies.dependencies,providerSessions:dependencies.providerSessions,identityVerifier:dependencies.identityVerifier,engine,platformNamespaceId:bindings.platformNamespaceId,ownerProfiles:bindings.ownerProfiles})
  });
  const expected=JSON.stringify(bindings);
  return {expiresAt:keysExpireAt,async handler(req,res){
   // Refresh public signing keys on the next request; never accept stale keys indefinitely.
   if(clock()>=keysExpireAt)throw Error('UAT_SIGNING_KEYS_REFRESH_REQUIRED');
   // Revoking/changing the owner-approved manifest fences future requests immediately.
   if(JSON.stringify(await loadHostedUatBindings({pool}))!==expected)throw Error('UAT_DEPLOYMENT_BINDINGS_CHANGED');
   await candidate.maintain();return candidate.handler(req,res);
  },close:()=>Promise.allSettled([candidate.close(),pool.end()])};
 }catch{
  await Promise.allSettled([candidate?.close(),pool.end()]);throw Error('UAT_HOSTED_RUNTIME_UNAVAILABLE');
 }
}
