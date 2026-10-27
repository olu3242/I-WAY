import {readdirSync,readFileSync,statSync} from 'node:fs';
import {resolve,sep,join} from 'node:path';
// Check exact spelling even on Windows: deployment filesystems can be case sensitive.
export function validatePublicImages(publicRoot){
 const root=resolve(publicRoot),findings=[];
 for(const page of readdirSync(root).filter(file=>file.endsWith('.html'))){
  const html=readFileSync(join(root,page),'utf8');
  for(const match of html.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)){
   const src=match[1];if(/^(?:https?:|data:|\/\/)/i.test(src))continue;
   let pathname;try{pathname=decodeURIComponent(src.split(/[?#]/)[0]).replace(/^\//,'');}catch{findings.push({page,source:src,reason:'INVALID_PATH'});continue;}
   const target=resolve(root,pathname);
   if(!target.startsWith(root+sep)){findings.push({page,source:src,reason:'OUTSIDE_PUBLIC_ROOT'});continue;}
   let current=root,valid=true;
   for(const part of pathname.split(/[\\/]/)){if(!part||!readdirSync(current).includes(part)){valid=false;break;}current=join(current,part);if(current!==target&&!statSync(current).isDirectory()){valid=false;break;}}
   if(!valid||!statSync(current).isFile())findings.push({page,source:src,reason:'MISSING_OR_CASE_MISMATCH'});
  }
 }
 return findings;
}
