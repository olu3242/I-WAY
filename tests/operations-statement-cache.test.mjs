import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/operations-fixture.mjs';
import {OperationsStore} from '../server/operations-store.mjs';

test('cached statements observe other connections, rollback, tenant scope and current principal authority',async t=>{
 const f=await fixture(t),other=new OperationsStore(f.path);try {
 const load=f.createLoad();
 // Warm every read before changing state in a separate connection.
 f.store.principal(f.manager.id);f.store.get('load',load.id,f.manager.tenantId);f.store.list('load',f.manager.tenantId);
 other.transaction(()=>other.update('load',load.id,f.manager.tenantId,load.version,{reference:'UPDATED'}));
 assert.equal(f.store.get('load',load.id,f.manager.tenantId).reference,'UPDATED');
 assert.throws(()=>f.store.get('load',load.id,f.outsider.tenantId),{code:'NOT_FOUND'});
 assert.equal(f.store.list('load',f.outsider.tenantId).length,0);
 assert.throws(()=>f.store.transaction(()=>{f.store.update('load',load.id,f.manager.tenantId,2,{reference:'ROLLBACK'});throw Error('rollback')}));
 assert.equal(f.store.get('load',load.id,f.manager.tenantId).reference,'UPDATED');
 other.db.prepare('UPDATE users SET data=? WHERE id=?').run(JSON.stringify({...f.manager,active:false}),f.manager.id);
 assert.equal(f.store.principal(f.manager.id).active,false);assert.throws(()=>f.ops.state(f.manager.id),{code:'SESSION'});
 assert.equal(f.store.db.prepare('PRAGMA journal_mode').get().journal_mode,'wal');assert.equal(f.store.db.prepare('PRAGMA synchronous').get().synchronous,2);
 } finally {other.close()} 
});
