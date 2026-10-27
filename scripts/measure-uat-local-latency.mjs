// Synthetic loopback measurement only. Never reads .env files or hosted URLs.
import {createServer,request} from 'node:http';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve,sep,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {uatApplicationFixture} from '../tests/helpers/uat-application-fixture.mjs';
import {durablePostgresFixture,durableUatFixture} from '../tests/helpers/durable-uat-fixture.mjs';
const output=resolve(process.argv[2]??'dist/b791-b820/local-http-latency.json');
if(!output.startsWith(resolve('dist')+sep))throw Error('LOCAL_MEASUREMENT_OUTPUT_REJECTED');
const postgresRequested=process.argv.includes('--postgres'),cleanup=[];
let postgres,server;
try{
 const f=await uatApplicationFixture({after:fn=>cleanup.push(fn)},{fullPermissions:true,platformPermissions:['platform:audit','platform:cases','platform:configure','platform:support']});
 if(postgresRequested)postgres=await durablePostgresFixture();
 const app=postgres?await durableUatFixture(f,postgres):f.integrated;
 server=createServer((req,res)=>app.handler(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const jars=new Map(),samples=[];
 async function send(role,path,{method='GET',body,csrf}={}){
  const jar=jars.get(role),started=performance.now();
  const response=await new Promise((resolve,reject)=>{
   const req=request({host:'127.0.0.1',port:server.address().port,path,method,headers:{host:new URL(f.origin).host,origin:f.origin,cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),...(body?{'content-type':'application/json'}:{}),...(csrf?{'x-csrf-token':csrf}:{})}},res=>{
    for(const cookie of res.headers['set-cookie']??[]){const [key,value]=cookie.split(';')[0].split('=');if(value)jar.set(key,value);else jar.delete(key);}
    const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks).toString(),durationMs:performance.now()-started}));
   });req.on('error',()=>reject(Error('LOCAL_FIXTURE_REQUEST_FAILED')));req.end(body?JSON.stringify(body):undefined);
  });
  return response;
 }
 for(const role of ['platform','carrier','fleet','driver']){
  jars.set(role,new Map());f.setLoginRole(role);
  if((await send(role,'/auth/login',{method:'POST'})).status!==303||(await send(role,'/auth/callback?code=synthetic')).status!==303)throw Error('LOCAL_FIXTURE_LOGIN_FAILED');
  const identity=await send(role,'/api/ops/session');if(identity.status!==200)throw Error('LOCAL_FIXTURE_IDENTITY_FAILED');const identityData=JSON.parse(identity.body);if(identityData.actor?.role!==role)throw Error('LOCAL_FIXTURE_ROLE_MISMATCH');const csrf=identityData.csrf;
  for(let i=0;i<16;i++){
   const document=await send(role,role==='platform'?'/uat/control':'/app');samples.push({role,operation:'authenticated_document_http',durationMs:document.durationMs,status:document.status});
   const api=await send(role,role==='platform'?'/api/ops/platform/workspace':'/api/ops/state',role==='platform'?{method:'POST',body:{action:'list'},csrf}:{});
   if(api.status===200){const data=JSON.parse(api.body);if(role==='platform'?!Array.isArray(data.configuration):data.actor?.role!==role)throw Error('LOCAL_FIXTURE_API_MISMATCH');}
   samples.push({role,operation:'authenticated_read_api',durationMs:api.durationMs,status:api.status});
  }
 }
 const groups=[];
 for(const role of ['platform','carrier','fleet','driver'])for(const operation of ['authenticated_document_http','authenticated_read_api']){
  const rows=samples.filter(s=>s.role===role&&s.operation===operation),times=rows.map(r=>r.durationMs).sort((a,b)=>a-b),sum=times.reduce((a,b)=>a+b,0);
  groups.push({role,operation,sampleCount:rows.length,p50Ms:times[Math.ceil(times.length*.5)-1],p95Ms:times[Math.ceil(times.length*.95)-1],sequentialThroughputPerSecond:rows.length/(sum/1000),failures:rows.filter(r=>r.status!==200).length});
 }
 const git=args=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 const report={schemaVersion:1,status:groups.every(g=>g.failures===0)?'MEASURED_LOCAL_ONLY':'FAIL',commit:git(['rev-parse','HEAD']),cleanSource:!git(['status','--porcelain']),backend:postgres?'disposable PostgreSQL':'disposable SQLite',scope:'Synthetic authenticated loopback HTTP; no Supabase service or hosted deployment contacted',conditions:{roles:4,sequential:true,samplesPerOperationPerRole:16,resourceCardinality:'Synthetic assigned-load fixture',documentMeasurement:'Server document fetch only; browser rendering and external network excluded',budgets:'No hosted/UAT latency budget inferred'},groups,hostedCertified:false};
 mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,samples:samples.length,backend:report.backend}));if(report.status==='FAIL')process.exitCode=1;
}catch{console.error('LOCAL_LATENCY_MEASUREMENT_FAILED');process.exitCode=1;}
finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}if(postgres)await postgres.close();for(const fn of cleanup.reverse())await fn();}
