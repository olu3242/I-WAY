import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createConnection} from 'node:net';
import {createAuthApplication} from '../server/operations-auth-application.mjs';
test('actual Node ingress rejects bounded malformed requests before protected operations',async()=>{
 let providerCalls=0,handlerCalls=0,requests=0;
 const denied=async()=>{providerCalls++;throw Error('must not run');};
 const app=createAuthApplication({origin:'https://staging.example.org',
  provider:{authorizationUrl:denied,exchangeCode:denied,getUser:denied,refresh:denied,logout:denied},
  transactions:{save:denied,consume:denied},sessions:{create:denied,get:denied,revoke:denied,refresh:denied},
  authorizeResource:async()=>{handlerCalls++;return true;}});
 const server=createServer((req,res)=>{requests++;return app(req,res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 async function raw(message){
  return new Promise((resolve,reject)=>{
   const socket=createConnection({host:'127.0.0.1',port:server.address().port});let body='';
   socket.setTimeout(2000,()=>socket.destroy(Error('local bounded probe timed out')));
   socket.on('connect',()=>socket.write(message));socket.on('data',chunk=>{body+=chunk.toString();if(body.length>16384)socket.destroy(Error('unexpected response size'));});
   socket.on('error',reject);socket.on('end',()=>resolve({status:Number(body.split(' ')[1]),body}));
  });
 }
 try{
  const cases=[
   ['GET /auth/session HTTP/1.1\r\nHost: localhost\r\nCookie: a=b\r\nCookie: c=d\r\nConnection: close\r\n\r\n',400],
   ['POST /auth/login HTTP/1.1\r\nHost: localhost\r\nOrigin: https://staging.example.org\r\nOrigin: https://staging.example.org\r\nContent-Length: 0\r\nConnection: close\r\n\r\n',400],
   ['POST /auth/login HTTP/1.1\r\nHost: localhost\r\nTransfer-Encoding: chunked\r\n\r\n',413],
   ['POST /auth/login HTTP/1.1\r\nHost: localhost\r\nContent-Length: 999999999\r\n\r\n',413],
   ['PUT /auth/session HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n',405],
   ['POST /auth/login HTTP/1.1\r\nHost: localhost\r\nContent-Length: 0\r\nConnection: close\r\n\r\n',403]
  ];
  for(const [message,status] of cases){const response=await raw(message);assert.equal(response.status,status);assert.match(response.body,/connection: close/i);}
  const before=requests;
  for(const framing of ['Content-Length: nope','Content-Length: 0\r\nContent-Length: 0','Content-Length: 1\r\nTransfer-Encoding: chunked']){
   const response=await raw('POST /auth/login HTTP/1.1\r\nHost: localhost\r\n'+framing+'\r\nConnection: close\r\n\r\n');
   assert.equal(response.status,400);
  }
  assert.equal(requests,before);assert.equal(providerCalls,0);assert.equal(handlerCalls,0);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
