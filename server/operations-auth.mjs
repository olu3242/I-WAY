import {randomBytes,scryptSync,timingSafeEqual,randomUUID} from 'node:crypto';
import {rolePermissions} from '../domain/authorization.mjs';
import {OpsError,text,requireValue} from '../domain/operations-errors.mjs';
import {issueSession,readSession,revokeSession} from './operations-identity.mjs';
export function passwordHash(password){
 requireValue(typeof password==='string'&&password.length>=12&&password.length<=256,'PASSWORD','Use a password between 12 and 256 characters.');
 const salt=randomBytes(16).toString('hex');
 return salt+':'+scryptSync(password,salt,64).toString('hex');
}
function passwordMatches(value,stored){
 const [salt,hash]=stored.split(':');const expected=Buffer.from(hash,'hex');
 const actual=scryptSync(typeof value==='string'&&value.length<=256?value:'invalid',salt,64);
 return expected.length===actual.length&&timingSafeEqual(expected,actual);
}
export function addUser(store,{tenantId,username,name,role,fleetId=null,customerId=null,password,permissions}){
 requireValue(store.tenant(tenantId)&&['carrier','dispatcher','driver','fleet','customer'].includes(role),'ACCOUNT','Invalid account relationship.');
 requireValue(!fleetId||['driver','fleet'].includes(role),'FLEET','Only fleet personnel may have a fleet employment relationship.');
 if(fleetId)requireValue(store.get('fleet',fleetId,tenantId).active,'FLEET','Fleet is inactive.');
 requireValue(role!=='fleet'||!!fleetId,'FLEET','Fleet account requires an owning fleet.');
 requireValue(role==='customer'?!!customerId:!customerId,'CUSTOMER','A customer account requires its own customer relationship.');
 if(customerId)requireValue(store.get('customer',customerId,tenantId).active,'CUSTOMER','Customer is inactive.');
 const grants=permissions??rolePermissions[role];
 requireValue(Array.isArray(grants)&&grants.every(p=>rolePermissions[role].includes(p)),'PERMISSIONS','Invalid permissions.');
 const actor={id:randomUUID(),tenantId,username:text(username).toLowerCase(),name:text(name),role,fleetId,customerId,permissions:[...new Set(grants)],active:true};
 store.db.prepare('INSERT INTO users(id,tenant_id,username,data,password) VALUES(?,?,?,?,?)').run(actor.id,tenantId,actor.username,JSON.stringify(actor),passwordHash(password));
 if(role==='driver')store.insert('driver',tenantId,{id:actor.id,name:actor.name,fleetId,driverId:actor.id,active:true,available:true,approved:false,compliance:'valid',expiresOn:'',status:'active'});
 return actor;
}
export function bootstrap(store,{tenantName,timezone,username,name,password}){
 new Intl.DateTimeFormat('en-US',{timeZone:timezone}).format(new Date());
 return store.transaction(()=>{
  requireValue(store.db.prepare('SELECT count(*) AS n FROM tenants').get().n===0,'INITIALIZED','Workspace is already initialized.',409);
  const tenantId=randomUUID();store.db.prepare('INSERT INTO tenants VALUES(?,?,?)').run(tenantId,text(tenantName),timezone);
  const actor=addUser(store,{tenantId,username,name,role:'carrier',password});
  store.audit(actor,'workspace:bootstrap',tenantId,'success',{role:actor.role});
  return actor;
 });
}
const dummy='0123456789abcdef0123456789abcdef:'+scryptSync('synthetic-non-user-value','0123456789abcdef0123456789abcdef',64).toString('hex');
export function authenticate(store,username,password,now=Date.now()){
 const row=store.db.prepare('SELECT id,data,password FROM users WHERE username=?').get(String(username??'').trim().toLowerCase());
 const matches=passwordMatches(password,row?.password??dummy);
 if(!row||!matches||!JSON.parse(row.data).active)throw new OpsError(401,'LOGIN','Sign-in failed.');
 return issueSession(store,JSON.parse(row.data),{now});
}
export function session(store,token,now=Date.now()){return readSession(store,token,now);}
export function logout(store,token,actor){return revokeSession(store,token,actor);}
