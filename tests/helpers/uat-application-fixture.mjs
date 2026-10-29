// Fully synthetic identities/resources, signed JWTs and native Operations store.
import {generateKeyPairSync,sign,createHash,randomUUID} from 'node:crypto';
import {fixture} from './operations-fixture.mjs';
import {uatFixture,syntheticRoster} from './uat-fixture.mjs';
import {addUser} from '../../server/operations-auth.mjs';
import {createIdentityVerifier} from '../../server/operations-identity.mjs';
import {createOperationsFeatures} from '../../domain/operations-features.mjs';
import {createIntegratedUatApplication} from '../../server/operations-uat-application.mjs';
export async function uatApplicationFixture(t,{fullPermissions=false,googleAssurance,feedbackPermissions=false,platformPermissions=['platform:audit']}={}){
 const native=await fixture(t,createOperationsFeatures()),governance=randomUUID();
 native.store.db.prepare('INSERT INTO tenants VALUES(?,?,?)').run(governance,'Illustrative governance namespace','UTC');
 const platform=addUser(native.store,{tenantId:governance,username:syntheticRoster[0].email,name:'Illustrative Platform',role:'platform',identityOnly:true,permissions:platformPermissions});
 const driver=native.store.get('driver',native.driver.id,native.driver.tenantId);native.store.update('driver',driver.id,driver.tenantId,driver.version,{fleetId:native.fleet.id});
 // Seed matching synthetic vehicle ownership before assignment; never move
 // hosted equipment or employment through this test-only fixture.
 const vehicle=native.store.get('vehicle',native.vehicle.id,native.manager.tenantId);
 native.store.update('vehicle',vehicle.id,vehicle.tenantId,vehicle.version,{fleetId:native.fleet.id,ownerType:'fleet',ownerId:native.fleet.id});
 // Assign after the explicit synthetic fleet employment is established.
 const assignment=native.assign();
 const actors=[platform,native.manager,native.fleetUser,native.driver];
 if(feedbackPermissions)for(const actor of actors)actor.uatFeedbackAccess=['submit',...(['platform','carrier','fleet'].includes(actor.role)?['triage']:[])];
 const roster=syntheticRoster.map((entry,i)=>({...entry,permissions:fullPermissions?[...actors[i].permissions]:entry.permissions,principalId:actors[i].id,tenantId:i===0?null:actors[i].tenantId,fleetId:i>=2?native.fleet.id:null}));
 for(let i=0;i<4;i++){
  const actor={...actors[i],identityOnly:true,permissions:[...roster[i].permissions],fleetId:roster[i].fleetId};
  native.store.db.prepare('UPDATE users SET data=?,password=? WHERE id=?').run(JSON.stringify(actor),'federated-only',actor.id);
 }
 const {publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),issuer='https://zolwjyhbfsxbdwyiwkbt.supabase.co/auth/v1';
 const verifier=createIdentityVerifier({issuer,audience:'authenticated',requireMfa:false,keys:[{kid:'synthetic-app',algorithm:'ES256',publicKey}]});
 const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const uat=uatFixture({roster,signAccessToken:({userId,assurance,now})=>{
  const message=encode({alg:'ES256',kid:'synthetic-app',typ:'JWT'})+'.'+encode({iss:issuer,aud:'authenticated',sub:userId,aal:assurance,iat:Math.floor(now/1000),exp:Math.floor(now/1000)+3600,jti:randomUUID()});
  return message+'.'+sign('sha256',Buffer.from(message),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
 }});t.after(()=>uat.db.close());
 // Existing explicit bindings only: production code never performs these inserts.
 for(const entry of roster)native.store.db.prepare('INSERT INTO identity_bindings VALUES(?,?,?,?,1)').run(issuer,createHash('sha256').update(entry.userId).digest('hex'),entry.principalId,entry.role==='platform'?governance:entry.tenantId);
 const origin='https://uat.illustrative.invalid',transactions=new Map();let loginRole='driver';
 const dependencies={origin,workflow:uat.workflow,providerSessions:uat.sessions,store:native.store,operations:native.ops,identityVerifier:verifier,platformNamespaceId:governance,
  googleProvider:{authorizationUrl:()=>origin+'/auth/callback?code=synthetic',exchangeCode:async()=>uat.tokens(roster.find(e=>e.role===loginRole).userId,googleAssurance??(['platform','carrier'].includes(loginRole)?'aal2':'aal1'))},
  transactions:{save:async tx=>transactions.set(tx.state,tx),consume:async id=>{const tx=transactions.get(id);transactions.delete(id);return tx;}},authorizeResource:async()=>false};
 const integrated=createIntegratedUatApplication(dependencies);
 return {...native,uat,roster,origin,integrated,dependencies,governance,assignment,setLoginRole:role=>{loginRole=role;}};
}
