import {generateKeyPairSync,sign,randomUUID} from 'node:crypto';
import {fixture,password} from './operations-fixture.mjs';
import {authenticate,addUser} from '../../server/operations-auth.mjs';
import {createIdentityVerifier,authenticateIdentity} from '../../server/operations-identity.mjs';
import {createInvitationService,createMockInvitationTransport} from '../../server/operations-invitations.mjs';
import {createHash} from 'node:crypto';
export async function invitationFixture(t,options={}){
 const f=await fixture(t,options);let time=Date.now();
 const issuer='https://enrollment.illustrative.invalid',audience='iway-fixture';
 const {publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 const verifier=createIdentityVerifier({issuer,audience,requireMfa:false,keys:[{kid:'fixture',algorithm:'ES256',publicKey}]});
 const token=(subject,changes={})=>{const input=[{alg:'ES256',kid:'fixture',typ:'JWT'},{iss:issuer,aud:audience,sub:subject,iat:Math.floor(time/1000),exp:Math.floor(time/1000)+1800,aal:'aal2',...changes}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');return input+'.'+sign('sha256',Buffer.from(input),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');};
 const tenantId=randomUUID();f.store.db.prepare('INSERT INTO tenants VALUES(?,?,?)').run(tenantId,'Illustrative platform governance','UTC');
 const platform=addUser(f.store,{tenantId,role:'platform',username:'reviewer@platform.illustrative.invalid',name:'Illustrative platform reviewer',password});
 f.store.db.prepare('INSERT INTO identity_bindings VALUES(?,?,?,?,1)').run(issuer,createHash('sha256').update('platform-reviewer').digest('hex'),platform.id,tenantId);
 const platformAuth=()=>authenticateIdentity(f.store,verifier,token('platform-reviewer'),time);
 const transport=createMockInvitationTransport();const service=createInvitationService(f.store,{verifier,transport,now:()=>time,ttlMs:120000});
 const auth=actor=>authenticate(f.store,actor.username,password,time);
 const input=(role='carrier',extra={})=>({recipient:randomUUID()+'@illustrative.invalid',name:'Illustrative invitation',role,issuer,subject:randomUUID(),...extra});
 return {...f,publicKey:publicKey.export({type:'spki',format:'pem'}),verifier,issuer,token,platform,platformAuth,transport,service,auth,input,now:()=>time,advance:ms=>time+=ms};
}
