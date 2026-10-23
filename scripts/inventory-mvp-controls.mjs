// Source inventory only. Discovery is never counted as successful execution.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export const inventorySources=['apps/operations/index.html','apps/operations/login.html','apps/operations/admin.html','apps/operations/ops.js','apps/operations/extended.js','apps/operations/intelligence.js','apps/operations/admin.js','apps/operations/login.js','server/operations-app.mjs','server/operations-uat-http.mjs','server/operations-uat-application.mjs'];
export function inventoryMvp(){
 const entries=new Map(),sourceHashes={};
 for(const path of inventorySources){
  const source=readFileSync(path,'utf8');sourceHashes[path]=createHash('sha256').update(source).digest('hex');
  function collect(type,pattern,value=m=>m[1],label=m=>m[1]){for(const m of source.matchAll(pattern)){
   const key=type+':'+value(m),location={path,line:source.slice(0,m.index).split('\n').length};
   if(!entries.has(key))entries.set(key,{key,type,value:value(m),label:label(m),locations:[],verification:'NOT_CERTIFIED_BY_DISCOVERY'});
   entries.get(key).locations.push(location);
  }}
  collect('action',/\bbutton\('([^']+)'\s*,\s*'([^']+)'/g,m=>m[2],m=>m[1]);
  collect('action',/data-action="([\w:-]+)"/g);
  collect('form',/<form\b[^>]*\bid="([\w-]+)"/g);
  collect('button',/<button\b[^>]*>([A-Za-z][A-Za-z &;]+)<\/button>/g);
  collect('field',/\b(?:field|select)\('([\w-]+)'/g);
  collect('field',/<(?:input|select|textarea)\b[^>]*\b(?:id|name)="([\w-]+)"/g);
  collect('disclosure',/<summary>([^<]+)<\/summary>/g);
  collect('dialog',/\b(?:prompt|confirm)\('([^']+)'/g);
  collect('route',/['"]((?:\/api\/ops|\/uat|\/auth|\/app|\/admin|\/portal|\/login|\/health|\/assets)[\w/.:?=-]*)['"]/g);
  for(const [index,line] of source.split('\n').entries())if(/\btabs(?:\.push|=)/.test(line))for(const m of line.matchAll(/\['([\w-]+)','([^']+)'\]/g)){
   const key='navigation:'+m[1];entries.set(key,{key,type:'navigation',value:m[1],label:m[2],locations:[{path,line:index+1}],verification:'NOT_CERTIFIED_BY_DISCOVERY'});
  }
 }
 // Explicit expansions of renderer expressions. No new capability is implied.
 const expansions={'edit-driver':'Manage driver','edit-vehicle':'Manage vehicle','driver:approve':'Carrier approval','vehicle:approve':'Carrier approval','orchestration:retry':'Retry review','orchestration:cancel':'Cancel review','connector:retry':'Retry review','connector:cancel':'Cancel review'};
 for(const [value,label] of Object.entries(expansions))entries.set('action:'+value,{key:'action:'+value,type:'action',value,label,locations:[{path:value.startsWith('orchestration:')||value.startsWith('connector:')?'apps/operations/intelligence.js':'apps/operations/ops.js',expression:true}],verification:'NOT_CERTIFIED_BY_DISCOVERY'});
 entries.set('navigation:loads',{key:'navigation:loads',type:'navigation',value:'loads',label:'Loads / My assignments',locations:[{path:'apps/operations/ops.js',expression:true}],verification:'NOT_CERTIFIED_BY_DISCOVERY'});
 for(const label of ['Set password','Sign in'])entries.set('button:'+label,{key:'button:'+label,type:'button',value:label,label,locations:[{path:'server/operations-uat-http.mjs',expression:true}],verification:'NOT_CERTIFIED_BY_DISCOVERY'});
 const controls=[...entries.values()].sort((a,b)=>a.key.localeCompare(b.key));
 return {schemaVersion:1,scope:'Implemented local Operations role views, company administration, platform governance and UAT authentication; excludes internal prototype and future features',personas:['platform','carrier','fleet','driver'],limitations:['Source expressions are expanded where known; runtime DOM inventory supplements discovery.','Source discovery and test references do not certify a control outcome.','APIs and form controls are inventoried separately; totals are not unique business-feature counts.'],sourceHashes,counts:Object.fromEntries([...new Set(controls.map(c=>c.type))].sort().map(type=>[type,controls.filter(c=>c.type===type).length])),controls};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const result=inventoryMvp();writeFileSync('docs/security/b591-mvp-inventory.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.counts));}
