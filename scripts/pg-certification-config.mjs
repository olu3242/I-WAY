import {postgresTlsOptions} from '../server/postgres-tls.mjs';
export function certificationConfig(mode,env=process.env){
 if(!['hosted','local'].includes(mode))throw new Error('Choose hosted or local certification explicitly');
 if(env.IWAY_PG_TEST_OPT_IN!=='1')throw new Error('IWAY_PG_TEST_OPT_IN=1 required; certification NOT RUN');
 for(const key of ['IWAY_PG_TEST_URL','IWAY_PG_TEST_HOST','IWAY_PG_TEST_CONSENT_VERSION']){
  if(!env[key])throw new Error(key+' required; certification NOT RUN');
 }
 if(!/^[a-zA-Z0-9._-]{1,30}$/.test(env.IWAY_PG_TEST_CONSENT_VERSION))throw new Error('Invalid test consent version');
 if(/^(?:TBC|TODO|placeholder|YOUR[_-].*)$/i.test(env.IWAY_PG_TEST_CONSENT_VERSION))throw new Error('Approved test consent version required');
 let url;try{url=new URL(env.IWAY_PG_TEST_URL)}catch{throw new Error('Invalid test database configuration')}
 if(!['postgres:','postgresql:'].includes(url.protocol)||url.hostname!==env.IWAY_PG_TEST_HOST||!url.password||!url.pathname.slice(1))throw new Error('Invalid test database configuration');
 // Do not allow connection-string options to override certificate verification.
 if(url.search||url.hash)throw new Error('Test database URL must not contain query options or a fragment');
 const user=decodeURIComponent(url.username);
 if(!/^iway_registration_login(?:\.[a-z0-9]+)?$/.test(user))throw new Error('Dedicated registration login required');
 const loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if(mode==='hosted'&&loopback)throw new Error('Hosted certification requires a remote PostgreSQL endpoint');
 if(mode==='local'&&!loopback)throw new Error('Local certification requires a loopback endpoint');
 if(mode==='hosted'){
  const project='vnoxdinldneeczxibicp';
  const direct=url.hostname==='db.'+project+'.supabase.co'&&user==='iway_registration_login';
  const pooled=url.hostname.endsWith('.pooler.supabase.com')&&user==='iway_registration_login.'+project;
  if(!direct&&!pooled)throw new Error('Hosted certification requires the authorized Supabase project');
 }
 return {connectionString:env.IWAY_PG_TEST_URL,consentVersion:env.IWAY_PG_TEST_CONSENT_VERSION,
  ssl:mode==='hosted'?postgresTlsOptions(url.hostname):false};
}
