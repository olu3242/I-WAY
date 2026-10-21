// B483: bounded streaming body reader for protected mutation endpoints.
// Consume only after method, Origin, Fetch Metadata and session checks have passed.
export async function readBoundedRequestBody(req,{maxBytes=65536,timeoutMs=10000}={}){
 if(!req||typeof req[Symbol.asyncIterator]!=='function'||
  !Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>65536||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)
  throw Error('BODY_READER_CONFIGURATION_INVALID');
 if(req.aborted===true)throw Error('BODY_REQUEST_ABORTED');
 // Native streams use bounded event consumption so rejection can be sent before close.
 if(typeof req.on==='function'&&typeof req.pause==='function'){
  return new Promise((resolve,reject)=>{
   const chunks=[];let size=0,settled=false;
   const finish=(error)=>{
    if(settled)return;settled=true;clearTimeout(timer);req.pause();
    req.off('data',onData);req.off('end',onEnd);req.off('error',onError);req.off('aborted',onAbort);req.off('close',onClose);
    error?reject(error):resolve(Buffer.concat(chunks,size));
   };
   const onAbort=()=>finish(Error('BODY_REQUEST_ABORTED'));
   const onError=()=>finish(Error('BODY_READ_FAILED'));
   const onClose=()=>{if(!req.readableEnded)onAbort();};
   const onEnd=()=>finish(req.aborted===true?Error('BODY_REQUEST_ABORTED'):undefined);
   const onData=chunk=>{
    if(req.aborted===true)return onAbort();
    if(!Buffer.isBuffer(chunk)&&typeof chunk!=='string')return onError();
    const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=bytes.length;
    if(size>maxBytes)return finish(Error('BODY_TOO_LARGE'));
    chunks.push(bytes);
   };
   const timer=setTimeout(()=>finish(Error('BODY_READ_TIMEOUT')),timeoutMs);
   req.on('error',onError);req.on('aborted',onAbort);req.on('close',onClose);req.on('end',onEnd);req.on('data',onData);
   if(req.readableEnded)onEnd();
  });
 }
 const chunks=[];
 let size=0;
 try{
  const source=typeof req.iterator==='function'?req.iterator({destroyOnReturn:false}):req;
  for await(const chunk of source){
   if(req.aborted===true)throw Error('BODY_REQUEST_ABORTED');
   if(!Buffer.isBuffer(chunk)&&typeof chunk!=='string')throw Error('BODY_CHUNK_INVALID');
   const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
   size+=bytes.length;
   if(size>maxBytes)throw Error('BODY_TOO_LARGE');
   chunks.push(bytes);
  }
  if(req.aborted===true)throw Error('BODY_REQUEST_ABORTED');
  return Buffer.concat(chunks,size);
 }catch(error){
  if(error?.message==='BODY_TOO_LARGE'||error?.message==='BODY_REQUEST_ABORTED')
   throw error;
  throw Error('BODY_READ_FAILED');
 }
}
