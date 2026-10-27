import {effectiveAdminDenials} from '../domain/operations-admin-policy.mjs';
// Local SQLite onboarding. No live mail transport or hosted provisioning is enabled.
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {addUser} from './operations-auth.mjs';
import {principalFingerprint,requireAssurance,verifyIdentityProof} from './operations-identity.mjs';
import {rolePermissions,canDelegatePermission} from '../domain/authorization.mjs';
import {fields,text,requireValue} from '../domain/operations-errors.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex');
const pending=['CREATED','SENT','OPENED','VERIFIED','FAILED'];
const transports=new WeakSet();
export const invitationSQL=`
 CREATE TABLE IF NOT EXISTS invitations(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),recipient TEXT NOT NULL,
 creator_id TEXT NOT NULL REFERENCES users(id),creator_fingerprint TEXT NOT NULL,
 assignment TEXT NOT NULL,issuer TEXT NOT NULL,subject_hash TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('CREATED','SENT','OPENED','VERIFIED','ACCEPTED','ACTIVE','EXPIRED','REVOKED','REJECTED','FAILED')),
 token_hash TEXT UNIQUE,expires_at INTEGER NOT NULL,user_id TEXT REFERENCES users(id),
 created_at INTEGER NOT NULL,last_sent_at INTEGER,send_key TEXT,send_count INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS invitation_deliveries(invitation_id TEXT NOT NULL REFERENCES invitations(id),request_key TEXT NOT NULL,PRIMARY KEY(invitation_id,request_key));
 CREATE UNIQUE INDEX IF NOT EXISTS invitation_pending_recipient ON invitations(recipient)
 WHERE state IN ('CREATED','SENT','OPENED','VERIFIED','FAILED');
 CREATE TRIGGER IF NOT EXISTS invitation_assignment_immutable BEFORE UPDATE ON invitations
 WHEN NEW.tenant_id<>OLD.tenant_id OR NEW.recipient<>OLD.recipient OR NEW.creator_id<>OLD.creator_id OR NEW.creator_fingerprint<>OLD.creator_fingerprint OR NEW.assignment<>OLD.assignment OR NEW.issuer<>OLD.issuer OR NEW.subject_hash<>OLD.subject_hash
 BEGIN SELECT RAISE(ABORT,'Invitation authority is immutable'); END;
 CREATE TRIGGER IF NOT EXISTS invitation_no_delete BEFORE DELETE ON invitations BEGIN SELECT RAISE(ABORT,'Deactivate invitations'); END;
`;
export function createMockInvitationTransport({fail=false}={}){
 const messages=[];const transport=Object.freeze({messages,send(message){if(fail)throw Error('MOCK_DELIVERY_FAILED');messages.push(Object.freeze(message));}});
 transports.add(transport);return transport;
}
const view=r=>({id:r.id,state:r.state,expiresAt:r.expires_at,userId:r.user_id??null});
export function createInvitationService(store,{verifier,transport,now=()=>Date.now(),ttlMs=86400000}={}){
 requireValue(Number.isSafeInteger(ttlMs)&&ttlMs>=60000&&ttlMs<=7*86400000,'INVITATION_CONFIG','Use a bounded invitation lifetime.');
 const clock=()=>{const n=now();requireValue(Number.isSafeInteger(n)&&n>=0&&n+ttlMs<=8640000000000000,'INVITATION_CONFIG','Invalid clock.');return n;};
 const transaction=fn=>store.transaction(fn);
 const actorFor=auth=>{
  const actor=store.principal(auth?.actor?.id);
  requireValue(actor?.active&&principalFingerprint(actor)===principalFingerprint(auth.actor),'SESSION','Sign in required.',401);
  // A trusted session is required for every invitation management operation.
  requireValue(isTrustedIdentitySession(store,auth,clock()),'SESSION','Sign in required.',401);
  if(actor.role==='platform')requireAssurance(auth);
  return actor;
 };
 const event=(r,state,actor)=>{store.db.prepare('UPDATE invitations SET state=? WHERE id=?').run(state,r.id);store.audit(actor,'invitation:'+state.toLowerCase(),r.id,'success',{state},new Date(clock()).toISOString());r.state=state;};
 const expire=r=>{if(pending.includes(r.state)&&r.expires_at<=clock()){event(r,'EXPIRED',{id:r.creator_id,tenantId:r.tenant_id});store.db.prepare('UPDATE invitations SET token_hash=NULL WHERE id=?').run(r.id);}return r;};
 const row=id=>{const r=store.db.prepare('SELECT * FROM invitations WHERE id=?').get(id);requireValue(r,'NOT_FOUND','Invitation not found.',404);return r;};
 const managed=(auth,id)=>{const actor=actorFor(auth),r=row(id);requireValue(r.tenant_id===actor.tenantId&&r.creator_id===actor.id,'NOT_FOUND','Invitation not found.',404);return {actor,r};};
 const validate=(actor,p)=>{
  const denied=effectiveAdminDenials(store,actor);actor={...actor,permissions:actor.permissions.filter(permission=>!denied.has(permission))};
  requireValue(['carrier','fleet','driver','platform'].includes(p.role),'ROLE','Unsupported onboarding role.');
  requireValue(Array.isArray(p.permissions)&&new Set(p.permissions).size===p.permissions.length&&p.permissions.every(x=>rolePermissions[p.role].includes(x)),'PERMISSIONS','Invalid grants.');
  if(p.role==='platform')requireValue(actor.role==='platform'&&actor.permissions.includes('platform:invite')&&p.permissions.every(x=>actor.permissions.includes(x))&&!p.fleetId,'FORBIDDEN','Platform authority requires a platform reviewer.',403);
  else if(actor.role==='fleet')requireValue(p.role==='driver'&&p.fleetId===actor.fleetId&&actor.permissions.includes('employment:manage'),'FORBIDDEN','Only own fleet employment may be managed.',403);
  else requireValue(actor.role==='carrier'&&actor.permissions.includes('user:manage')&&p.permissions.every(x=>canDelegatePermission(actor,p.role,x))&&(p.role!=='driver'||!p.fleetId),'FORBIDDEN','Assignment exceeds reviewer authority.',403);
  requireValue(p.role!=='fleet'||!!p.fleetId,'FLEET','An owning fleet is required.');
  requireValue(!p.fleetId||['fleet','driver'].includes(p.role),'FLEET','Invalid fleet relationship.');
  if(p.fleetId)requireValue(store.get('fleet',p.fleetId,actor.tenantId).active,'FLEET','Fleet relationship is inactive.',403);
 };
 const byToken=token=>{
  requireValue(typeof token==='string'&&/^[A-Za-z0-9_-]{43}$/.test(token),'INVITATION','Invitation unavailable.',401);
  const r=store.db.prepare('SELECT * FROM invitations WHERE token_hash=?').get(hash(token));
  requireValue(r,'INVITATION','Invitation unavailable.',401);expire(r);
  requireValue(['SENT','OPENED','VERIFIED'].includes(r.state),'INVITATION','Invitation unavailable.',409);return r;
 };
 return Object.freeze({
  list(auth){const actor=actorFor(auth);requireValue(actor.role==='platform'?actor.permissions.includes('platform:invite'):actor.role==='carrier'?actor.permissions.includes('user:manage'):actor.role==='fleet'&&actor.permissions.includes('employment:manage'),'FORBIDDEN','Invitation management authority required.',403);return transaction(()=>store.db.prepare('SELECT * FROM invitations WHERE tenant_id=? AND creator_id=? ORDER BY created_at DESC LIMIT 100').all(actor.tenantId,actor.id).map(row=>({...view(expire(row)),name:JSON.parse(row.assignment).name,role:JSON.parse(row.assignment).role})));},
  create(auth,input){
   fields(input,['recipient','name','role','permissions','fleetId','issuer','subject']);
   const actor=actorFor(auth),recipient=text(input.recipient,254).toLowerCase();
   requireValue(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient),'RECIPIENT','Use a valid recipient.');
   const assignment={name:text(input.name,120),role:input.role,permissions:input.permissions??rolePermissions[input.role],fleetId:input.fleetId??null};
   validate(actor,assignment);
   // Subject is established through a separately verified enrollment review, never email metadata.
   requireValue(verifier?.issuer===input.issuer&&typeof input.subject==='string'&&input.subject===input.subject.trim()&&input.subject.length>0&&input.subject.length<=512&&!/[\u0000-\u001f\u007f]/.test(input.subject),'IDENTITY','A configured issuer and approved subject are required.');
   return transaction(()=>{
    for(const old of store.db.prepare('SELECT * FROM invitations WHERE recipient=?').all(recipient))expire(old);
    requireValue(!store.db.prepare('SELECT 1 FROM users WHERE username=?').get(recipient),'ACCOUNT_EXISTS','Account already exists.',409);
    requireValue(!store.db.prepare("SELECT 1 FROM invitations WHERE recipient=? AND state IN ('CREATED','SENT','OPENED','VERIFIED','FAILED')").get(recipient),'INVITATION_EXISTS','Invitation already exists.',409);
    requireValue(!store.db.prepare('SELECT 1 FROM identity_bindings WHERE issuer=? AND subject_hash=?').get(input.issuer,hash(input.subject)),'BINDING_EXISTS','Identity already enrolled.',409);
    requireValue(store.db.prepare('SELECT count(*) AS n FROM invitations WHERE creator_id=? AND created_at>?').get(actor.id,clock()-3600000).n<10,'RATE_LIMIT','Invitation creation limit reached.',429);
    const id=randomUUID(),at=clock();
    store.db.prepare('INSERT INTO invitations(id,tenant_id,recipient,creator_id,creator_fingerprint,assignment,issuer,subject_hash,state,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,actor.tenantId,recipient,actor.id,principalFingerprint(actor),JSON.stringify(assignment),input.issuer,hash(input.subject),'CREATED',at+ttlMs,at);
    const r=row(id);event(r,'CREATED',actor);return view(r);
   });
  },
  send(auth,id,key){
   requireValue(transports.has(transport),'DELIVERY_DISABLED','Only isolated mock delivery is configured.',503);text(key,100);
   return transaction(()=>{
    const {actor,r}=managed(auth,id);expire(r);
    requireValue(['CREATED','SENT','OPENED','VERIFIED','FAILED'].includes(r.state),'INVITATION_STATE','Invitation cannot be sent.',409);
    requireValue(r.creator_fingerprint===principalFingerprint(actor),'AUTHORITY_CHANGED','Create a newly reviewed invitation.',403);
    validate(actor,JSON.parse(r.assignment));
    if(store.db.prepare('SELECT 1 FROM invitation_deliveries WHERE invitation_id=? AND request_key=?').get(r.id,key))return view(r);
    requireValue(r.send_count<5&&(!r.last_sent_at||clock()-r.last_sent_at>=60000),'RATE_LIMIT','Wait before resending.',429);
    store.db.prepare('INSERT INTO invitation_deliveries VALUES(?,?)').run(r.id,key);
    const token=randomBytes(32).toString('base64url');
    store.db.prepare('UPDATE invitations SET token_hash=?,last_sent_at=?,send_key=?,send_count=send_count+1 WHERE id=?').run(hash(token),clock(),key,r.id);
    try{transport.send({invitationId:r.id,recipient:r.recipient,token});event(r,'SENT',actor);}
    catch{store.db.prepare('UPDATE invitations SET token_hash=NULL WHERE id=?').run(r.id);event(r,'FAILED',actor);}
    return view(r);
   });
  },
  open(token){return transaction(()=>{const r=byToken(token);if(r.state==='SENT')event(r,'OPENED',{id:r.creator_id,tenantId:r.tenant_id});return view(r);});},
  accept(token,identityToken){
   const proof=verifyIdentityProof(verifier,identityToken,clock());
   return transaction(()=>{
    const r=byToken(token),creator=store.principal(r.creator_id),p=JSON.parse(r.assignment);
    requireValue(creator?.active&&principalFingerprint(creator)===r.creator_fingerprint,'AUTHORITY_CHANGED','Invitation needs a new review.',403);validate(creator,p);
    requireValue(proof.issuer===r.issuer&&hash(proof.subject)===r.subject_hash,'IDENTITY','Recipient identity does not match.',401);
    requireValue(p.role!=='platform'||proof.assurance==='aal2','MFA_REQUIRED','Multi-factor identity required.',403);
    requireValue(!store.db.prepare('SELECT 1 FROM users WHERE username=?').get(r.recipient),'ACCOUNT_EXISTS','Account already exists.',409);
    requireValue(!store.db.prepare('SELECT 1 FROM identity_bindings WHERE issuer=? AND subject_hash=?').get(r.issuer,r.subject_hash),'BINDING_EXISTS','Identity already enrolled.',409);
    if(r.state==='SENT')event(r,'OPENED',creator);event(r,'VERIFIED',creator);
    // Federated enrollment only: no password is generated, stored, or delivered.
    const user=addUser(store,{...p,tenantId:r.tenant_id,username:r.recipient,identityOnly:true});
    store.db.prepare('INSERT INTO identity_bindings VALUES(?,?,?,?,1)').run(r.issuer,r.subject_hash,user.id,user.tenantId);
    store.db.prepare('UPDATE invitations SET user_id=?,token_hash=NULL WHERE id=?').run(user.id,r.id);r.user_id=user.id;
    event(r,'ACCEPTED',user);event(r,'ACTIVE',user);return view(r);
   });
  },
  revoke(auth,id){return transaction(()=>{const {actor,r}=managed(auth,id);requireValue(pending.includes(r.state),'INVITATION_STATE','Invitation is terminal.',409);store.db.prepare('UPDATE invitations SET token_hash=NULL WHERE id=?').run(id);event(r,'REVOKED',actor);return view(r);});},
  reject(token){return transaction(()=>{const r=byToken(token);store.db.prepare('UPDATE invitations SET token_hash=NULL WHERE id=?').run(r.id);event(r,'REJECTED',{id:r.creator_id,tenantId:r.tenant_id});return view(r);});},
  inspect(auth,id){return transaction(()=>{const {r}=managed(auth,id);return view(expire(r));});}
 });
}
import {isTrustedIdentitySession} from './operations-identity.mjs';
