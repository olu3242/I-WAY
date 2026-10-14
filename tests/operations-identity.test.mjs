import test from'node:test';import assert from'node:assert/strict';import{generateKeyPairSync,sign,randomUUID,createHash}from'node:crypto';
import{fixture,password}from'./helpers/operations-fixture.mjs';import{createOperationsFeatures}from'../domain/operations-features.mjs';
import{authenticate,session,addUser}from'../server/operations-auth.mjs';import{issueSession,bindIdentity,revokeIdentityBinding,revokeSessions,createIdentityVerifier,authenticateIdentity,requireAssurance}from'../server/operations-identity.mjs';
const issuer='https://identity.illustrative.invalid',audience='illustrative-iway',now=Date.now();
function keyFixture(algorithm='ES256'){
 const keys=algorithm==='ES256'?generateKeyPairSync('ec',{namedCurve:'prime256v1'}):generateKeyPairSync('rsa',{modulusLength:2048});
 const verifier=createIdentityVerifier({issuer,audience,keys:[{kid:'fixture',algorithm,publicKey:keys.publicKey}]});
 const token=(changes={},headerChanges={})=>{
  const header=Buffer.from(JSON.stringify({alg:algorithm,kid:'fixture',typ:'JWT',...headerChanges})).toString('base64url');
  const claims=Buffer.from(JSON.stringify({iss:issuer,aud:audience,sub:'fixture-subject',iat:Math.floor(now/1000),exp:Math.floor(now/1000)+1800,aal:'aal2',...changes})).toString('base64url');
  const input=header+'.'+claims,signature=sign('sha256',Buffer.from(input),algorithm==='ES256'?{key:keys.privateKey,dsaEncoding:'ieee-p1363'}:keys.privateKey).toString('base64url');return input+'.'+signature;
 };return {verifier,token};
}
test('sessions enforce idle expiry, authority fingerprints and audited revocation with metadata cascade',async t=>{
 const f=await fixture(t,createOperationsFeatures()),a=authenticate(f.store,f.manager.username,password,now);
 assert.equal(a.verifiedMfa,false);assert.throws(()=>requireAssurance(a),e=>e.code==='MFA_REQUIRED');
 assert.equal(session(f.store,a.token,now+30*60000),null);assert.equal(f.store.db.prepare('SELECT count(*) AS n FROM session_security').get().n,0);
 const b=authenticate(f.store,f.manager.username,password,now),changed={...f.manager,permissions:f.manager.permissions.filter(p=>p!=='governance:manage')};
 f.store.db.prepare('UPDATE users SET data=? WHERE id=?').run(JSON.stringify(changed),f.manager.id);assert.equal(session(f.store,b.token,now+1),null);
 const c=authenticate(f.store,f.manager.username,password,now);f.command(f.manager,'session:revoke',null,{reason:'Fixture revoke'});assert.equal(session(f.store,c.token,now+1),null);
 const d=authenticate(f.store,f.driver.username,password,now);assert.throws(()=>revokeSessions(f.store,f.outsider,f.driver.id),e=>e.code==='NOT_FOUND');assert.ok(session(f.store,d.token,now+1));
 const legacy='illustrative-legacy-token';f.store.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(createHash('sha256').update(legacy).digest('hex'),f.driver.id,'illustrative-csrf',now+10000);assert.equal(session(f.store,legacy,now+1),null);
});
test('real RS256 and ES256 signatures require exact issuer audience time and verified MFA claims',()=>{
 for(const algorithm of ['RS256','ES256']){
  const k=keyFixture(algorithm);assert.equal(k.verifier.verify(k.token(),now).assurance,'aal2');
  for(const claims of [{iss:issuer+'/wrong'},{aud:'wrong'},{sub:'  invalid '},{exp:Math.floor(now/1000)},{iat:Math.floor(now/1000)+1},{iat:Math.floor(now/1000)-4000},{nbf:Math.floor(now/1000)+60},{aal:'aal1'},{aal:undefined}])assert.throws(()=>k.verifier.verify(k.token(claims),now),e=>e.code==='IDENTITY');
  for(const header of [{alg:'none'},{kid:'unknown'},{jku:'https://untrusted.illustrative.invalid'}])assert.throws(()=>k.verifier.verify(k.token({},header),now),e=>e.code==='IDENTITY');
  const pieces=k.token().split('.');pieces[2]=Buffer.alloc(Buffer.from(pieces[2],'base64url').length).toString('base64url');assert.throws(()=>k.verifier.verify(pieces.join('.'),now),e=>e.code==='IDENTITY');
 }
});
test('federated identity uses server-owned subject binding, rejects forged assurance, and revokes persisted sessions',async t=>{
 const f=await fixture(t,createOperationsFeatures()),k=keyFixture();
 assert.throws(()=>authenticateIdentity(f.store,k.verifier,k.token(),now),e=>e.code==='IDENTITY');
 bindIdentity(f.store,f.manager,{issuer,subject:'fixture-subject',userId:f.dispatcher.id,reason:'Approved isolated fixture mapping'});
 const a=authenticateIdentity(f.store,k.verifier,k.token({user_metadata:{role:'carrier',tenantId:f.outsider.tenantId}}),now);
 assert.equal(a.actor.id,f.dispatcher.id);assert.equal(a.actor.role,'dispatcher');assert.equal(requireAssurance(a),true);assert.equal(requireAssurance(session(f.store,a.token,now+1)),true);
 assert.throws(()=>requireAssurance({...a}),e=>e.code==='MFA_REQUIRED');
 assert.throws(()=>issueSession(f.store,f.manager,{now,proof:{issuer,subject:'fixture-subject',assurance:'aal2',expiresAt:now+10000}}),e=>e.code==='IDENTITY');
 assert.throws(()=>authenticateIdentity(f.store,{verify:()=>({})},k.token(),now),e=>e.code==='IDENTITY_CONFIG');
 revokeIdentityBinding(f.store,f.manager,{issuer,subject:'fixture-subject',userId:f.dispatcher.id,reason:'Fixture revoke'});assert.equal(session(f.store,a.token,now+2),null);
 assert.throws(()=>authenticateIdentity(f.store,k.verifier,k.token(),now),e=>e.code==='IDENTITY');
 const audit=JSON.stringify(f.store.db.prepare('SELECT detail FROM audit').all());assert.ok(!audit.includes(a.token));assert.ok(!audit.includes('fixture-subject'));
});
test('limited managers cannot bind higher authority or widen relationships through role promotion',async t=>{
 const f=await fixture(t,createOperationsFeatures()),limited=addUser(f.store,{tenantId:f.manager.tenantId,role:'carrier',permissions:['user:manage'],username:'limited@illustrative.invalid',name:'Illustrative limited manager',password});
 assert.throws(()=>bindIdentity(f.store,limited,{issuer,subject:'controlled-subject',userId:f.manager.id,reason:'Denied mapping'}),e=>e.code==='PERMISSIONS');
 const change=(actor,target,payload,version=0)=>f.ops.execute(actor.id,{action:'user:access',resourceId:target.id,expectedVersion:version,payload:{...payload,reason:'Fixture access review'},idempotencyKey:randomUUID()});
 assert.throws(()=>change(limited,f.dispatcher,{role:'carrier',permissions:['load:dispatch']}),e=>e.code==='PERMISSIONS');
 assert.throws(()=>change(f.manager,f.manager,{permissions:[]}),e=>e.code==='SELF_ACCESS');
 assert.throws(()=>change(f.manager,f.outsider,{permissions:[]}),e=>e.code==='NOT_FOUND');
 assert.throws(()=>change(f.manager,f.driver,{role:'carrier',permissions:['load:view']}),e=>e.code==='ROLE_RELATIONSHIP');
 const active=authenticate(f.store,f.dispatcher.username,password,now);
 const updated=change(f.manager,f.dispatcher,{role:'carrier',permissions:['load:view']});assert.equal(updated.authVersion,1);assert.equal(updated.role,'carrier');assert.equal(session(f.store,active.token,now+1),null);
 assert.throws(()=>change(f.manager,f.dispatcher,{permissions:[]}),e=>e.code==='STALE');
});
