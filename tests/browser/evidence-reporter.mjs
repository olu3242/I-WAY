import{readFileSync,writeFileSync,mkdirSync,readdirSync}from'node:fs';
import{join,relative,resolve,sep}from'node:path';
import{createHash}from'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
function files(root){return readdirSync(root,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(join(root,entry.name)):[join(root,entry.name)]);}
function browserSourceHashes(){const candidates=[...files('apps/operations'),...files('domain'),...files('server'),...files('lib/intelligence'),...files('tests/helpers'),...files('tests/browser'),'playwright.config.mjs','package-lock.json'];return Object.fromEntries(candidates.sort().map(p=>[p.replaceAll('\\','/'),sha(/\.(woff2|ttf)$/.test(p)?readFileSync(p):readFileSync(p,'utf8').replace(/\r\n/g,'\n'))]));}
export default class BrowserEvidenceReporter{
 onBegin(config,suite){this.started=new Date().toISOString();this.total=suite.allTests().length;this.tests=[];this.scans=[];this.controls=[];this.responsive=[];this.sourceHashes=browserSourceHashes();}
 onTestEnd(test,result){
  this.tests.push({title:test.title,status:result.status,expectedStatus:test.expectedStatus,durationMs:result.duration,retry:result.retry});
  for(const a of result.attachments){
   if(a.contentType!=='application/json')continue;
   let data;try{data=JSON.parse(a.body?a.body.toString():readFileSync(a.path,'utf8'));}catch{continue;}
   if(data.kind==='mvp-control-evidence'){this.controls.push({test:test.title,status:result.status,...data});continue;}
   if(['responsive-layout','responsive-workflow'].includes(data.kind)){this.responsive.push({test:test.title,status:result.status,...data});continue;}
   if(!Array.isArray(data.tags)||!Array.isArray(data.violations)||!data.engine)continue;
   this.scans.push({test:test.title,label:a.name,engine:data.engine,viewport:data.viewport,violations:data.violations.length,incompleteRules:(data.incomplete??[]).map(r=>r.id),passedRules:data.passedRules.length});
  }
 }
 onEnd(result){
  const sourceHashes=this.sourceHashes,sourceUnchanged=JSON.stringify(sourceHashes)===JSON.stringify(browserSourceHashes());
  const counts={total:this.total,passed:this.tests.filter(t=>t.status==='passed').length,failed:this.tests.filter(t=>['failed','timedOut','interrupted'].includes(t.status)).length,skipped:this.tests.filter(t=>t.status==='skipped').length};
  const summary={schemaVersion:1,scope:'isolated local application; no hosted certification',startedAt:this.started,completedAt:new Date().toISOString(),sourceHashEncoding:'SHA-256; UTF-8 LF text, raw WOFF2',durationMs:result.duration,status:sourceUnchanged?result.status:'source_changed_during_run',sourceUnchanged,counts,tests:this.tests,accessibility:{tags:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'],scanCount:this.scans.length,violationCount:this.scans.reduce((n,s)=>n+s.violations,0),incompleteRuleIds:[...new Set(this.scans.flatMap(s=>s.incompleteRules))],conformance:'manual_review_required',manualChecks:['Screen-reader task flows and live announcements','Meaningful reading/focus order across complex content','400% browser zoom and user text-spacing adjustments','Touch and speech input','Native approval dialogs with assistive technology','Usability with disabled users'],scans:this.scans},sourceHashes};
  summary.responsive={scope:'local synthetic identities only',observations:this.responsive};
  const output=process.env.IWAY_BROWSER_EVIDENCE_DIR??'dist';if(resolve(output)!==resolve('dist')&&!resolve(output).startsWith(resolve('dist')+sep))throw Error('BROWSER_EVIDENCE_OUTPUT_REJECTED');
  summary.backend=process.env.IWAY_BROWSER_DURABLE_OPT_IN==='true'?'disposable PostgreSQL':'disposable SQLite';
  mkdirSync(output,{recursive:true});writeFileSync(join(output,'browser-evidence.json'),JSON.stringify(summary,null,2)+'\n');
  writeFileSync(join(output,'mvp-control-evidence.json'),JSON.stringify({scope:'local synthetic browser evidence',status:result.status,disclaimer:'Observed controls and interactions do not certify outcomes. Only explicit verifiedOutcomes in passing tests do.',tests:this.controls,sourceUnchanged},null,2)+'\n');
 }
}
