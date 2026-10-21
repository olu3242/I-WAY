// B483: bounded streaming body reader for protected mutation endpoints.
// Consume only after method, Origin, Fetch Metadata and session checks have passed.
export async function readBoundedRequestBody(req,{maxBytes=65536}={}){
 if(!req||typeof req[Symbol.asyncIterator]!=='function'||
  !Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>65536)
  throw Error('BODY_READER_CONFIGURATION_INVALID');
 const chunks=[];
 let size=0;
 try{
  for await(const chunk of req){
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
