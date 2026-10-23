import {generateKeyPairSync,sign} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {canonical,digest} from '../../domain/hosted-evidence.mjs';
import {hostedPrerequisites,hostedScenarios} from '../../domain/operations-release.mjs';
import {HostedEvidenceStore,safeRead} from '../../server/hosted-evidence-store.mjs';

export function evidenceFixture(t){
 const root=mkdtempSync(join(tmpdir(),'iway-evidence-test-'));
 mkdirSync(join(root,'artifacts'));mkdirSync(join(root,'attestations'));
 let now='2026-10-13T12:00:00.000Z';
 const binding={tenant:'tenant_a',environment:'staging',sourceHash:'a'.repeat(64),gitSha:'b'.repeat(40)};
 const secrets={},keys={};
 const purposes=['DRAFT','SUBMITTED','VALIDATED','REVIEWED','ACCEPTED','REVOKED','REJECTED','EXPIRED','SUPERSEDED'].map(x=>'transition:'+x);
 for(const name of ['collector','reviewer','authority','security','release']){
  const pair=generateKeyPairSync('ed25519');secrets[name]=pair.privateKey;
  keys[name]={subjectId:name,publicKey:pair.publicKey.export({format:'pem',type:'spki'}),purposes:name==='authority'?['authorize',...hostedPrerequisites.map(x=>'approve:'+x)]:name==='security'?['security-release']:name==='release'?['production-release']:purposes,tenants:['tenant_a'],environments:['staging'],notBefore:'2026-10-12T00:00:00.000Z',expiresAt:'2026-10-15T00:00:00.000Z',revoked:false};
 }
 const envelope=(keyId,payload)=>({keyId,payload,signature:sign(null,Buffer.from(canonical(payload)),secrets[keyId]).toString('base64')});
 const policy={keys,revokedAuthorizations:[],revokedAttestations:[],readAttestation:hash=>safeRead(root,`attestations/${hash}.json`)};
 const prerequisites=Object.fromEntries(hostedPrerequisites.map((name,i)=>{
  const raw=Buffer.from(canonical({fixture:'illustrative',prerequisite:name})),hash=digest(raw);writeFileSync(join(root,'attestations',hash+'.json'),raw);
  return [name,envelope('authority',{id:'attestation_'+i,prerequisite:name,...binding,evidenceSha256:hash,approvedAt:now,expiresAt:'2026-10-14T00:00:00.000Z'})];
 }));
 const authorization=envelope('authority',{schemaVersion:1,id:'grant_one',...binding,scenarios:hostedScenarios.map(s=>s.id),prerequisites,notBefore:now,expiresAt:'2026-10-14T00:00:00.000Z',syntheticOnly:true,noRealDelivery:true});
 const record=(patch={})=>{
  const r={schemaVersion:1,id:'evidence_one',batch:'B247',scenario:'identity',...binding,artifact:{path:'',sha256:''},collector:'collector',collectedAt:now,method:'approved-hosted-runner',result:'PASS',assertions:{verifiedMfa:true,tenantBound:true,revokedSessionDenied:true},authorizationRef:'grant_one',expiresAt:'2026-10-14T00:00:00.000Z',provenance:{scope:'independent-hosted',runId:'run_one'},...patch};
  const a={schemaVersion:1,runId:r.provenance.runId,scenario:r.scenario,...binding,scope:r.provenance.scope,result:r.result,assertions:r.assertions};
  const raw=Buffer.from(canonical(a)),hash=digest(raw);r.artifact={path:`artifacts/${hash}.json`,sha256:hash};writeFileSync(join(root,r.artifact.path),raw);return r;
 };
 const stores=[];const open=()=>{const store=new HostedEvidenceStore({database:join(root,'ledger.sqlite'),artifactRoot:root,policy,binding,now:()=>now});stores.push(store);return store};
 let count=0;
 const request=(r,from,to,revision,key='collector',requestId='request_'+(++count))=>({record:revision===0?r:undefined,envelope:envelope(key,{recordId:r.id,recordDigest:digest(canonical(r)),from,to,revision,at:now,requestId,authorizationRef:r.authorizationRef}),authorization});
 t.after(()=>{for(const s of stores)try{s.close()}catch{}const path=resolve(root);if(!path.startsWith(resolve(tmpdir())+sep+'iway-evidence-test-'))throw Error('UNSAFE_TEST_CLEANUP');rmSync(path,{recursive:true,force:true,maxRetries:5,retryDelay:100})});
 return {root,binding,policy,authorization,envelope,record,open,request,setNow:value=>{now=value},now:()=>now};
}
