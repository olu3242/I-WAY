// Local policy check only. Does not invoke git push or contact Vercel.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
export const protectedBranch='work/b561-b580-external-uat';
export function assertDeploymentPolicy(config){
 const rules=config?.git?.deploymentEnabled;
 if(config?.outputDirectory!=='site/public'||!rules||rules[protectedBranch]!==false||Object.values(rules).some(v=>v!==false))throw Error('UAT_AUTOMATIC_DEPLOYMENT_POLICY_MISSING');
 return true;
}
export function assertPushAllowed(input){
 if(input.trim())throw Error('PUSH_REQUIRES_SEPARATE_OWNER_AUTHORIZATION');
 return true; // A hook with no ref updates performs no push.
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{if(process.argv.includes('--hook'))assertPushAllowed(readFileSync(0,'utf8'));else assertDeploymentPolicy(JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8')));}
 catch{console.error('BLOCKED: push requires separate owner authorization; automatic UAT Git deployment must remain disabled.');process.exitCode=1;}
}
