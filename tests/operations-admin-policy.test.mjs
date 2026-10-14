import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {authorizeConfigured,projectConfiguredFields} from '../domain/operations-admin-policy.mjs';
function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE organization_admin(tenant_id TEXT,kind TEXT,id TEXT,data TEXT);CREATE TABLE users(id TEXT,data TEXT)");
 const actor={id:'a',tenantId:'tenant-a',role:'carrier',active:true,permissions:['load:view','load:dispatch']};
 db.prepare('INSERT INTO users VALUES(?,?)').run(actor.id,JSON.stringify(actor));
 const store={db,principal:id=>JSON.parse(db.prepare('SELECT data FROM users WHERE id=?').get(id)?.data??'null')};
 const add=(tenantId,kind,id,data)=>db.prepare('INSERT INTO organization_admin VALUES(?,?,?,?)').run(tenantId,kind,id,JSON.stringify(data));
 return {store,actor,add};
}
test('explicit assignment applies deny only and cannot expand baseline authority',()=>{
 const {store,actor,add}=fixture(),resource={tenantId:'tenant-a',kind:'load'};
 assert.equal(authorizeConfigured({store,actor,action:'load:dispatch',resource}),true);
 add('tenant-a','permission-set','restricted',{name:'restricted',grants:[],denials:['load:dispatch']});
 assert.equal(authorizeConfigured({store,actor,action:'load:dispatch',resource}),true);
 add('tenant-a','permission-assignment',actor.id,{name:'assigned',setIds:['restricted']});
 assert.equal(authorizeConfigured({store,actor,action:'load:dispatch',resource}),false);
 assert.equal(authorizeConfigured({store,actor,action:'load:view',resource}),true);
 assert.equal(authorizeConfigured({store,actor,action:'load:view',resource:{tenantId:'tenant-b'}}),false);
});
test('configured field read restrictions remove data from server projection',()=>{
 const {store,actor,add}=fixture();
 add('tenant-a','field-security','sensitive',{name:'sensitive',object:'load',field:'rateCents',read:['dispatcher']});
 assert.deepEqual(projectConfiguredFields({store,actor,object:'load',record:{id:'l1',rateCents:999}}),{id:'l1'});
 assert.deepEqual(projectConfiguredFields({store,actor,object:'vehicle',record:{id:'v1',rateCents:999}}),{id:'v1',rateCents:999});
});
test('unconfigured standalone engine retains baseline behavior',()=>{
 const db=new DatabaseSync(':memory:');const actor={id:'a',tenantId:'t',role:'carrier',active:true,permissions:['load:view']};
 const store={db,principal:()=>actor};
 assert.equal(authorizeConfigured({store,actor,action:'load:view',resource:{tenantId:'t'}}),true);
 assert.deepEqual(projectConfiguredFields({store,actor,object:'load',record:{id:'x'}}),{id:'x'});
});
