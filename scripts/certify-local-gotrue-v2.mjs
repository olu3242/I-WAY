// Actual disposable GoTrue protocol checks. Never invokes Google or hosted Auth.
import {spawnSync} from 'node:child_process';
import {randomBytes,randomUUID,createHmac} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const cli='dist/b902-b1000/tools/cli-2.122.0/supabase.exe';
const s=spawnSync(cli,['status','--workdir','C:/IWAY-Recovery-Lab-V2','-o','json'],{encoding:'utf8'});
if(s.status!==0)throw Error('LOCAL_STATUS_REQUIRED');
const config=JSON.parse(s.stdout);
if(config.API_URL!=='http://127.0.0.1:60421')throw Error('LOOPBACK_AUTH_REQUIRED');
const checks=[],users=[];
async function request(path,{method='GET',body,token,admin=false,expected=200}={}){
 const r=await fetch(config.API_URL+'/auth/v1'+path,{method,redirect:'error',signal:AbortSignal.timeout(10000),headers:{apikey:config.ANON_KEY,authorization:'Bearer '+(admin?config.SERVICE_ROLE_KEY:token??config.ANON_KEY),'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 if(r.status!==expected){const e=Error('LOCAL_AUTH_STATUS');e.status=r.status;e.path=path.split('?')[0];throw e}if(r.status===204)return null;return r.json();
}
function totp(secret){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const c of secret)bits+=alphabet.indexOf(c).toString(2).padStart(5,'0');const key=Buffer.from(bits.match(/.{8}/g).map(b=>parseInt(b,2))),counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const h=createHmac('sha1',key).update(counter).digest(),offset=h[19]&15;return ((h.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,'0');}
try{
 for(const persona of ['platform','carrier','fleet','driver']){
  const email='recovery-'+persona+'-'+randomUUID()+'@example.invalid',password=randomBytes(32).toString('base64url');
  const user=await request('/admin/users',{method:'POST',admin:true,body:{email,password,email_confirm:true}});users.push(user.id);
  const login=await request('/token?grant_type=password',{method:'POST',body:{email,password}});if(login.user.id!==user.id||!login.access_token||!login.refresh_token)throw Error('LOCAL_IDENTITY_MISMATCH');checks.push({persona,check:'actual_gotrue_password_login',status:'PASS'});
  const invalid=await fetch(config.API_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:config.ANON_KEY,'content-type':'application/json'},body:JSON.stringify({email,password:'invalid-synthetic-credential'})});if(invalid.ok)throw Error('INVALID_PASSWORD_ACCEPTED');checks.push({persona,check:'invalid_password_denied',status:'PASS'});
  const refreshed=await request('/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:login.refresh_token}});if(refreshed.user.id!==user.id)throw Error('REFRESH_IDENTITY_MISMATCH');checks.push({persona,check:'actual_refresh',status:'PASS'});
  let access=refreshed.access_token;
  if(['platform','carrier'].includes(persona)){
   const factor=await request('/factors',{method:'POST',token:access,body:{factor_type:'totp',issuer:'Iway local recovery'}});
   const challenge=await request('/factors/'+factor.id+'/challenge',{method:'POST',token:access,body:{}});
   const verified=await request('/factors/'+factor.id+'/verify',{method:'POST',token:access,body:{challenge_id:challenge.id,code:totp(factor.totp.secret)}});
   if(JSON.parse(Buffer.from(verified.access_token.split('.')[1],'base64url')).aal!=='aal2')throw Error('LOCAL_AAL2_REQUIRED');access=verified.access_token;checks.push({persona,check:'actual_totp_aal2',status:'PASS'});
  }
  await request('/logout?scope=global',{method:'POST',token:access,expected:204});checks.push({persona,check:'logout',status:'PASS'});
  const revoked=await fetch(config.API_URL+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:config.ANON_KEY,'content-type':'application/json'},body:JSON.stringify({refresh_token:refreshed.refresh_token})});if(revoked.ok)throw Error('REVOKED_REFRESH_ACCEPTED');checks.push({persona,check:'revoked_refresh_denied',status:'PASS'});
 }
 const result={status:'PASS_LOCAL_GOTRUE_PROTOCOL_ONLY',checks,syntheticLocalUsers:users.length,credentialsLogged:false,google:'BLOCKED_EXTERNAL_PROVIDER',applicationAuthorization:'SEPARATE_SYNTHETIC_APPLICATION_SUITES',hostedExecuted:false};writeFileSync('dist/b902-b1000/recovery/gotrue-certification.json',JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,checks:checks.length,syntheticUsers:users.length}));
}catch(e){writeFileSync('dist/b902-b1000/recovery/gotrue-certification-failure.json',JSON.stringify({status:'FAIL',code:e.message,httpStatus:e.status??null,path:e.path??null,completedChecks:checks,syntheticLocalUsers:users.length,hostedExecuted:false},null,2));console.error(JSON.stringify({status:'FAIL_LOCAL_GOTRUE',code:e.message,httpStatus:e.status,completedChecks:checks.length}));process.exitCode=1;}
