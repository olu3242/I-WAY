import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {join,normalize,extname} from 'node:path';
import {registerLead} from './lead-store.mjs';
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8'};
export function makeApp({root='site/public',dbPath='data/early-access.json',register=lead=>registerLead(dbPath,lead),sopHandler=null}={}){
 const rate=new Map();
 return createServer(async(req,res)=>{
  const respond=(status,obj)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj))};
  let url;try{url=new URL(req.url,'http://localhost')}catch{return respond(400,{error:'Bad URL'})}
  if(url.pathname.startsWith('/api/v1/support/')){if(!sopHandler)return respond(503,{error:'support_unavailable'});return sopHandler(req,res,url)}
  if(url.pathname==='/api/health')return respond(200,{status:'ok'});
  if(url.pathname==='/api/early-access'){
   if(req.method!=='POST')return respond(405,{error:'Method not allowed'});
   if(req.headers['content-type']?.split(';')[0]!=='application/json')return respond(415,{error:'JSON required'});
   const ip=req.socket.remoteAddress??'unknown',now=Date.now(),bucket=rate.get(ip)??[];
   const recent=bucket.filter(t=>now-t<60000);if(recent.length>=10)return respond(429,{error:'Please try again later'});
   recent.push(now);rate.set(ip,recent);
   let body='';try{for await(const chunk of req){body+=chunk;if(body.length>8192)return respond(413,{error:'Request too large'})}}catch{return respond(400,{error:'Invalid request body'})}
   let input;try{input=JSON.parse(body)}catch{return respond(400,{error:'Invalid JSON'})}
   try{const result=await register(input);return respond(result.created?201:200,{status:'received'})}
   catch(e){return respond(e.message?.startsWith('Invalid')?400:503,{error:e.message?.startsWith('Invalid')?'Please check your registration fields':'Registration unavailable'})}
  }
  if(req.method!=='GET'&&req.method!=='HEAD')return respond(405,{error:'Method not allowed'});
  let path;try{path=decodeURIComponent(url.pathname)}catch{return respond(400,{error:'Bad URL'})}
  if(path.includes('..')||path.includes('\\')||path.startsWith('/.'))return respond(404,{error:'Not found'});
  const rel=path==='/'?'index.html':path.slice(1);const safe=normalize(rel);if(safe.startsWith('..'))return respond(404,{error:'Not found'});
  try{const bytes=await readFile(join(root,safe));res.writeHead(200,{'Content-Type':types[extname(safe)]??'application/octet-stream','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; img-src 'self' data:; base-uri 'self'; form-action 'self'"});res.end(req.method==='HEAD'?undefined:bytes)}catch{return respond(404,{error:'Not found'})}
 });
}
