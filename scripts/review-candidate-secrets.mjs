// Prints only counts and paths. Never print matched content or credential hashes.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,lstatSync,mkdirSync} from 'node:fs';
import {resolve,sep,dirname} from 'node:path';
const args=process.argv.slice(2),argument=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
const output=resolve(argument('--output')??'dist/figma-gap-closure/secret-review.json');
if(!output.startsWith(resolve('dist')+sep))throw Error('SECRET_REVIEW_OUTPUT_REJECTED');
const privateFile=argument('--private-env');
if(!privateFile)throw Error('PRIVATE_ENV_LOCATION_REQUIRED');
const privateValues=[];
for(const line of readFileSync(privateFile,'utf8').split(/\r?\n/)){
 const match=/^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);if(!match)continue;
 const [name,value]=match.slice(1);if(!/(?:SECRET|PASSWORD|SERVICE_ROLE|OPENAI_API_KEY|DATABASE_URL)/.test(name)||!value.trim())continue;
 const unquoted=value.trim().replace(/^(['"])(.*)\1$/,'$2');if(unquoted.length>=8)privateValues.push(Buffer.from(unquoted));
 if(/DATABASE_URL/.test(name))try{const password=decodeURIComponent(new URL(unquoted).password);if(password.length>=8)privateValues.push(Buffer.from(password));}catch{}
}
const paths=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).split('\0').filter(Boolean))];
const gitlinks=new Set(execFileSync('git',['ls-files','--stage','-z'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).split('\0').filter(x=>x.startsWith('160000 ')).map(x=>x.split('\t')[1]));
const matches=[];let count=0;
function scan(path,bytes,formats=true){
 if(privateValues.some(value=>bytes.includes(value)))matches.push({path,category:'configured_private_credential'});
 if(formats){
  const text=bytes.toString('utf8');
  if(/sk-proj-[A-Za-z0-9_-]{50,}|GOCSPX-[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))matches.push({path,category:'private_secret_format'});
  for(const token of text.matchAll(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{24,}/g))try{if(JSON.parse(Buffer.from(token[0].split('.')[1],'base64url')).role==='service_role')matches.push({path,category:'service_role_jwt'});}catch{}
 }
}
for(const path of paths){if(gitlinks.has(path))continue;const file=resolve(path),info=lstatSync(file);if(!info.isFile()||info.isSymbolicLink())throw Error('CANDIDATE_NON_REGULAR_FILE');scan(path,readFileSync(file));count++;}
const archives=(argument('--archive')??'').split(',').filter(Boolean);for(const path of archives){const file=resolve(path);if(!file.startsWith(resolve('dist')+sep))throw Error('SECRET_REVIEW_ARCHIVE_REJECTED');scan(path,readFileSync(file),false);}
const envPathTracked=paths.some(p=>/(^|\/)\.env\.local$/.test(p));
let envPathIgnored=false;try{execFileSync('git',['check-ignore','--quiet','.env.local'],{stdio:'ignore'});envPathIgnored=true;}catch{}
const report={status:!matches.length&&!envPathTracked&&envPathIgnored?'PASS':'FAIL',candidateRegularFilesScanned:count,unchangedGitlinksExcluded:[...gitlinks],archivesScanned:archives.length,configuredPrivateCredentialMatches:matches.filter(m=>m.category==='configured_private_credential').length,matches,envPathIgnored,envPathTracked,privateValuesPrinted:false,scope:'Configured private values and decoded DB password exact-match scan, selected private-secret formats; not a universal or historical secret-scanning guarantee'};
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(report.status!=='PASS')process.exitCode=1;
