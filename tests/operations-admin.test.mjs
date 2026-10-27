import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createOperationsAdmin} from '../server/operations-admin.mjs';
function setup(){
 const db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE tenants(id TEXT PRIMARY KEY,name TEXT,timezone TEXT);CREATE TABLE users(id TEXT PRIMARY KEY,tenant_id TEXT,data TEXT);INSERT INTO tenants VALUES('a','A Logistics','UTC'),('b','B Logistics','UTC')");
 const actors={
  owner:{id:'owner',tenantId:'a',role:'carrier',permissions:['governance:manage'],active:true},
  other:{id:'other',tenantId:'b',role:'carrier',permissions:['governance:manage'],active:true},
  dispatcher:{id:'dispatcher',tenantId:'a',role:'dispatcher',permissions:['governance:manage'],active:true}
 };
 for(const a of Object.values(actors))db.prepare('INSERT INTO users VALUES(?,?,?)').run(a.id,a.tenantId,JSON.stringify(a));
 const store={db,tenant:id=>db.prepare('SELECT id,name,timezone FROM tenants WHERE id=?').get(id),principal:id=>JSON.parse(db.prepare('SELECT data FROM users WHERE id=?').get(id)?.data||'null'),transaction:fn=>{db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result}catch(e){db.exec('ROLLBACK');throw e}}};
 return {db,admin:createOperationsAdmin(store),actors};
}
test('organization admin CRUD isolates tenants and rejects stale versions',()=>{
 const {admin,actors,db}=setup();
 assert.equal(admin.updateSettings(actors.owner,{legalName:'A Logistics',currency:'USD'},0).ok,true);
 assert.equal(admin.getSettings(actors.other).version,0);
 assert.equal(admin.updateSettings(actors.owner,{legalName:'Changed'},0).code,'CONFLICT');
 assert.equal(admin.upsert(actors.owner,'permission-set','dispatch',{name:'dispatch',grants:['load:view'],denials:[]},0).ok,true);
 assert.equal(admin.list(actors.other,'permission-set').items.length,0);
 assert.equal(admin.upsert(actors.owner,'permission-set','dispatch',{name:'dispatch',grants:[],denials:[]},0).code,'CONFLICT');
 assert.equal(admin.remove(actors.owner,'permission-set','dispatch',1).ok,true);
 assert.equal(admin.list(actors.owner,'permission-set').items.length,0);
 const retained=db.prepare("SELECT version,data FROM organization_admin WHERE id='dispatch'").get();
 assert.equal(retained.version,2);assert.equal(JSON.parse(retained.data)._deactivated,true);
 assert.equal(admin.audit(actors.owner).events[0].operation,'deactivate');
 assert.equal(admin.audit(actors.owner).events.length,3);
});
test('admin blocks noncarrier and revoked governance permission',()=>{
 const {admin,actors,db}=setup();
 assert.equal(admin.getSettings(actors.dispatcher).code,'FORBIDDEN');
 db.prepare('UPDATE users SET data=? WHERE id=?').run(JSON.stringify({...actors.owner,permissions:[]}),actors.owner.id);
 assert.equal(admin.getSettings(actors.owner).code,'FORBIDDEN');
});
test('admin rejects malformed metadata and arbitrary validation operators',()=>{
 const {admin,actors}=setup();
 assert.equal(admin.upsert(actors.owner,'validation-rule','rule',{name:'rule',object:'load',field:'customerId',operator:'eval'},0).code,'INVALID_INPUT');
 assert.equal(admin.upsert(actors.owner,'permission-set','set',{name:'set',grants:'*',denials:[]},0).code,'INVALID_INPUT');
 assert.equal(admin.upsert(actors.owner,'related-tab','tab',{name:'tab',unknown:'x'},0).code,'INVALID_INPUT');
});
