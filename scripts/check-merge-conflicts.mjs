#!/usr/bin/env node
// Fail closed on unresolved Git merge markers in tracked source and configuration.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const paths=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const ignoredPrefixes=['docs/','evidence/','artifacts/'];
const extensions=/\.(?:mjs|cjs|js|jsx|ts|tsx|json|ya?ml|html|css|sql|sh)$/i;
const findings=[];
for(const path of paths){
 if(ignoredPrefixes.some(prefix=>path.startsWith(prefix))||!extensions.test(path))continue;
 let contents;
 try{contents=readFileSync(path,'utf8')}catch(error){
  if(error.code==='ENOENT')continue;
  throw error;
 }
 for(const [index,line] of contents.split(/\r?\n/).entries()){
  if(/^(?:<{7}(?: .*)?|={7}|>{7}(?: .*)?)$/.test(line)){
   findings.push(path+':'+(index+1)+': '+line);
  }
 }
}
if(findings.length){
 console.error('Unresolved merge conflict markers ('+findings.length+'):\n'+findings.join('\n'));
 process.exitCode=1;
}else console.log('Conflict marker check passed for '+paths.length+' tracked paths.');
