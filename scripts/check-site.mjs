import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {validatePublicImages} from './lib/public-image-contract.mjs';
const missingImages=validatePublicImages('site/public');if(missingImages.length)throw Error('Public image contract: '+JSON.stringify(missingImages));
const pages=['index.html','early-access.html','privacy.html','terms.html'];
for(const page of pages){const html=await readFile('site/public/'+page,'utf8');if(!html.includes('<main')||!html.includes('<title>'))throw new Error('Invalid page '+page);}
const form=await readFile('site/public/early-access.html','utf8');
const config={window:{}};vm.runInNewContext(await readFile('site/public/assets/js/config.js','utf8'),config);
const script=await readFile('site/public/assets/js/site.js','utf8');
if(!form.includes('id="ea-form"')||!script.includes("querySelector('#ea-form')"))throw Error('Form handler mismatch');
if(!config.window.IWAY_CONFIG.earlyAccessEndpoint){
 if(!form.includes('Preview build.')||!form.includes('nothing you enter is sent or stored.')||!script.includes('if(endpoint)'))throw Error('Preview disclosure and delivery guard required');
}else if(!script.includes('fetch(endpoint'))throw Error('Configured registration service has no handler');
console.log('Site structure and configured/preview registration contract PASS');
