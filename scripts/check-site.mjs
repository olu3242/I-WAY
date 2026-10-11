import {readFile} from 'node:fs/promises';
const pages=['index.html','early-access.html','privacy.html','terms.html'];
for(const page of pages){const html=await readFile('site/public/'+page,'utf8');if(!html.includes('<main')||!html.includes('<title>'))throw new Error('Invalid page '+page);}
const form=await readFile('site/public/early-access.html','utf8');if(!form.includes('action="/api/early-access"'))throw new Error('Form not connected to registration API');
console.log('Site structure check PASS: '+pages.length+' pages');
