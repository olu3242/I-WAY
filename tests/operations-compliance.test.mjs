import test from'node:test';import assert from'node:assert/strict';import{createHash}from'node:crypto';import{fixture,password}from'./helpers/operations-fixture.mjs';import{createOperationsFeatures}from'../domain/operations-features.mjs';import{addUser}from'../server/operations-auth.mjs';import{createComplianceExtensions}from'../domain/operations-compliance.mjs';import{securityConfigurationReport,classifySecurityEvent}from'../server/operations-security-readiness.mjs';
test('retention requires independent current approval and previews never delete local operational data',async t=>{
 const f=await fixture(t,createOperationsFeatures()),l=f.assign();f.store.insert('tracking',f.manager.tenantId,{loadId:l.id,at:'2020-01-01T00:00:00Z'});
 const p=f.command(f.manager,'retention:propose',null,{resourceKind:'tracking',minimumDays:30,reason:'Illustrative policy review'});
 assert.throws(()=>f.command(f.manager,'retention:decide',p,{decision:'approved',reason:'Self review'}),e=>e.code==='SEPARATION');
 const second=addUser(f.store,{tenantId:f.manager.tenantId,username:'reviewer@illustrative.invalid',name:'Illustrative independent governor',role:'carrier',password});
 const approved=f.command(second,'retention:decide',p,{decision:'approved',reason:'Fixture review only, no production legal approval'});
 const preview=f.command(f.manager,'retention:preview',approved);assert.equal(preview.candidateIds.length,1);assert.equal(preview.executionEnabled,false);assert.equal(f.store.list('tracking',f.manager.tenantId).length,1);
 const current=f.store.principal(second.id);f.store.db.prepare('UPDATE users SET data=? WHERE id=?').run(JSON.stringify({...current,permissions:[]}),second.id);
 assert.throws(()=>f.command(f.manager,'retention:preview',approved),e=>e.code==='APPROVAL_AUTHORITY');
 assert.throws(()=>f.command(f.dispatcher,'retention:propose',null,{resourceKind:'tracking',minimumDays:1,reason:'Denied'}),e=>e.code==='FORBIDDEN');
});
test('audit exports are bounded tenant metadata with integrity hash and recheck revoked authority on replay',async t=>{
 const f=await fixture(t,createOperationsFeatures());f.createLoad();const p={limit:5,fromSequence:0,reason:'Illustrative audit review'},a=f.command(f.manager,'audit:export',null,p,'audit-export-replay');
 assert.equal(a.reason,p.reason);assert.equal(f.store.get('governanceexport',a.id,f.manager.tenantId).reason,p.reason);assert.ok(a.entries.length<=5);assert.ok(a.entries.every(e=>!Object.hasOwn(e,'detail')));
 assert.equal(a.sha256,createHash('sha256').update(JSON.stringify(a.entries)).digest('hex'));
 assert.throws(()=>f.store.update('governanceexport',a.id,f.manager.tenantId,a.version,{entries:[]}),/immutable/);
 assert.throws(()=>f.command(f.driver,'audit:export',null,p),e=>e.code==='FORBIDDEN');
 const me=f.store.principal(f.manager.id);f.store.db.prepare('UPDATE users SET data=? WHERE id=?').run(JSON.stringify({...me,permissions:me.permissions.filter(p=>p!=='audit:view')}),me.id);
 assert.throws(()=>f.command(f.manager,'audit:export',null,p,'audit-export-replay'),e=>e.code==='FORBIDDEN');
 const own=f.command(f.driver,'privacy:export');assert.equal(own.profile.id,f.driver.id);assert.equal(own.credentialsIncluded,false);assert.ok(!JSON.stringify(own).includes(password));
});
test('consent defaults fail closed and isolated approved fixture versions never activate production consent',async t=>{
 const f=await fixture(t,createOperationsFeatures()),p={version:'ILL-CONSENT-1',purpose:'fixture-only',decision:'accept'};
 assert.throws(()=>f.command(f.driver,'consent:record',null,p),e=>e.code==='CONSENT_UNAPPROVED');assert.equal(f.store.list('consentrecord',f.manager.tenantId).length,0);
 Object.assign(f.ops.extensions,createComplianceExtensions({approvedConsents:[{version:p.version,purpose:p.purpose,textSha256:'a'.repeat(64),approved:true}]}));
 const record=f.command(f.driver,'consent:record',null,p);assert.equal(record.userId,f.driver.id);assert.equal(f.ops.state(f.manager.id).consentRecords.length,0);assert.equal(f.ops.state(f.driver.id).consentRecords.length,1);
 assert.throws(()=>f.command(f.driver,'consent:record',null,{...p,version:'TODO'}),e=>e.code==='CONSENT_VERSION');
 assert.throws(()=>f.store.update('consentrecord',record.id,f.manager.tenantId,record.version,{decision:'withdraw'}),/immutable/);
});
test('secret inventory and incident classification return no configured values or raw errors',()=>{
 const marker='SYNTHETIC-SECRET-MUST-NOT-APPEAR',report=securityConfigurationReport({DATABASE_URL:marker,SUPABASE_SERVICE_ROLE_KEY:marker,SUPABASE_DB_PASSWORD:marker,IWAY_CONSENT_VERSION:''});
 assert.ok(!JSON.stringify(report).includes(marker));assert.equal(report.databaseFormatAndTLS,'BLOCKED');assert.equal(report.credentialRotation,'UNVERIFIED');assert.equal(report.hostedDecision,'NO-GO');
 assert.equal(classifySecurityEvent({status:403,code:marker}).category,'authorization');assert.ok(!JSON.stringify(classifySecurityEvent({status:500,code:marker})).includes(marker));
});
