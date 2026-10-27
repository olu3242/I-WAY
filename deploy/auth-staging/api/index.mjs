import {randomUUID} from 'node:crypto';
import {createAuthRuntime} from '../server/operations-auth-runtime.mjs';
// The packaging script puts this entrypoint and its runtime together.
// No root api/ route is added to the public marketing project.
let runtime;
export const config={api:{bodyParser:false}};
export default async function handler(req,res){
 try{
  runtime??=createAuthRuntime().catch(error=>{runtime=undefined;throw error;});
  const app=await runtime;
  return await app.handler(req,res);
 }catch{
  const requestId=randomUUID();res.setHeader('x-request-id',requestId);
  console.info(JSON.stringify({event:'auth_runtime_unavailable',requestId,status:503}));
  res.statusCode=503;
  res.setHeader('content-type','application/json; charset=utf-8');
  res.setHeader('cache-control','no-store');
  res.setHeader('x-content-type-options','nosniff');
  res.end('{"error":"AUTH_UNAVAILABLE"}');
 }
}
