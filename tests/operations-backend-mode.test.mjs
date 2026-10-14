import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveBackendMode} from '../domain/operations-backend-mode.mjs';
test('local SQLite remains explicitly non-hosted',()=>assert.deepEqual(resolveBackendMode('local'),{engine:'sqlite',sync:true,certifiedForHosted:false}));
test('uncertified hosted backend fails closed',()=>assert.throws(()=>resolveBackendMode('hosted'),{code:'OPERATIONS_BACKEND_NOT_READY'}));
test('invalid backend mode fails closed',()=>assert.throws(()=>resolveBackendMode('unknown'),{code:'OPERATIONS_BACKEND_NOT_READY'}));
test('caller-asserted certification cannot enable unintegrated PostgreSQL',()=>assert.throws(()=>resolveBackendMode('hosted',{postgresCertified:true}),{code:'OPERATIONS_BACKEND_NOT_READY'}));
