import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {readBoundedRequestBody} from '../server/operations-supabase-bounded-body.experimental.mjs';

test('B483 accepts body at byte limit, including streamed chunks',async()=>{
 const req=Readable.from([Buffer.alloc(32000,65),Buffer.alloc(33536,66)]);
 const body=await readBoundedRequestBody(req);
 assert.equal(body.length,65536);
 assert.equal(body[0],65);
 assert.equal(body.at(-1),66);
});
test('B483 rejects actual bytes above limit without trusting Content-Length',async()=>{
 const req=Readable.from([Buffer.alloc(65536),Buffer.from('x')]);
 req.headers={'content-length':'1'};
 await assert.rejects(()=>readBoundedRequestBody(req),/BODY_TOO_LARGE/);
});
test('B483 rejects aborted streams and invalid limits',async()=>{
 const req=Readable.from([Buffer.from('secret')]);
 req.aborted=true;
 await assert.rejects(()=>readBoundedRequestBody(req),/BODY_REQUEST_ABORTED/);
 await assert.rejects(()=>readBoundedRequestBody(Readable.from([]),{maxBytes:65537}),/BODY_READER_CONFIGURATION_INVALID/);
});
