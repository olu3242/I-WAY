export class ConfigurationError extends Error {}
const fail=(name,status)=>{throw new ConfigurationError(name+': '+status)};
export function serverConfig(env=process.env){
 const port=env.PORT??'4173';
 if(!/^\d+$/.test(port)||Number(port)>65535)fail('PORT',port===''?'EMPTY':'INVALID');
 if(env.NODE_ENV!==undefined&&!['development','test','production'].includes(env.NODE_ENV))fail('NODE_ENV','INVALID');
 const config={port:Number(port),dbPath:env.IWAY_LEADS_FILE??'data/early-access.json'};
 if(env.DATABASE_URL===undefined){
  if(env.NODE_ENV==='production')fail('DATABASE_URL','MISSING');
  return config;
 }
 if(env.DATABASE_URL==='')fail('DATABASE_URL','EMPTY');
 let url;
 try{url=new URL(env.DATABASE_URL)}catch{fail('DATABASE_URL','INVALID')}
 let username,password;
 try{username=decodeURIComponent(url.username);password=decodeURIComponent(url.password)}catch{fail('DATABASE_URL','INVALID')}
 if(!['postgres:','postgresql:'].includes(url.protocol)||!url.hostname||!url.pathname.slice(1)||!password||
    !/^iway_registration_login(?:\.[a-z0-9]+)?$/.test(username)||url.search||url.hash){
  fail('DATABASE_URL','INVALID');
 }
 if(/(?:YOUR[_ -]|REPLACE[_ -]|CHANGE[_ -]?ME|<[^>]+>|\[[A-Z_ -]+\]|^TBC$|^TODO$|placeholder)/i.test(password))fail('DATABASE_URL','PLACEHOLDER');
 const loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if(env.PGSSL!=='require'&&(!loopback||!['',undefined].includes(env.PGSSL)))fail('PGSSL',env.PGSSL===undefined?'MISSING':env.PGSSL===''?'EMPTY':'INVALID');
 if(!env.IWAY_CONSENT_VERSION)fail('IWAY_CONSENT_VERSION',env.IWAY_CONSENT_VERSION===undefined?'MISSING':'EMPTY');
 if(!/^[a-zA-Z0-9._-]{1,30}$/.test(env.IWAY_CONSENT_VERSION))fail('IWAY_CONSENT_VERSION','INVALID');
 if(/^(?:TBC|TODO|placeholder|YOUR[_-].*)$/i.test(env.IWAY_CONSENT_VERSION))fail('IWAY_CONSENT_VERSION','PLACEHOLDER');
 return {...config,consentVersion:env.IWAY_CONSENT_VERSION,postgres:{connectionString:env.DATABASE_URL,
  ssl:env.PGSSL==='require'?{rejectUnauthorized:true}:false,connectionTimeoutMillis:10000}};
}
