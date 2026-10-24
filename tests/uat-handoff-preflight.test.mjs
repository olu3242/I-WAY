import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {handoffPreflight,requiredUatNames} from '../scripts/uat-handoff-preflight.mjs';
test('real provisioning remains blocked and preflight emits names without supplied secret values',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../docs/security/uat-provisioning-manifest.json',import.meta.url)));
 const result=handoffPreflight({env:{DATABASE_URL:'sensitive-marker'},manifest});
 assert.equal(result.status,'BLOCKED');assert.equal(result.missingPreview.length,13);assert.equal(result.runtimeLogin.auth,'BLOCKED_MISSING_RESTRICTED_CREDENTIAL');assert.equal(result.runtimeLogin.operations,'BLOCKED_MISSING_RESTRICTED_CREDENTIAL');assert.ok(!JSON.stringify(result).includes('sensitive-marker'));
});

test('legacy twelve-key configuration cannot omit the separate Operations runtime credential',()=>{
 const legacy=requiredUatNames.filter(n=>n!=='IWAY_OPERATIONS_DATABASE_URL');
 const env=Object.fromEntries(legacy.map(n=>[n,'synthetic-private-marker']));
 const result=handoffPreflight({env,previewNames:legacy,manifest:{testers:[]}});
 assert.equal(result.status,'BLOCKED');assert.deepEqual(result.missingLocal,['IWAY_OPERATIONS_DATABASE_URL']);assert.deepEqual(result.missingPreview,['IWAY_OPERATIONS_DATABASE_URL']);
 assert.equal(result.runtimeLogin.operations,'BLOCKED_MISSING_RESTRICTED_CREDENTIAL');assert.ok(!JSON.stringify(result).includes('synthetic-private-marker'));
});
test('matching variable names alone cannot certify identity provisioning or hosted access',()=>{
 const result=handoffPreflight({env:Object.fromEntries(requiredUatNames.map(n=>[n,'synthetic'])),previewNames:requiredUatNames,manifest:{testers:[]}});
 assert.equal(result.status,'BLOCKED');assert.equal(result.missingPreview.length,0);
});

test('blank runtime credentials remain missing in both name and login reports',()=>{
 const env={IWAY_AUTH_DATABASE_URL:' ',IWAY_UAT_DATABASE_URL:'\t',IWAY_OPERATIONS_DATABASE_URL:''};
 const result=handoffPreflight({env,manifest:{testers:[]}});
 assert.ok(Object.keys(env).every(n=>result.missingLocal.includes(n)));
 assert.ok(Object.values(result.runtimeLogin).every(s=>s==='BLOCKED_MISSING_RESTRICTED_CREDENTIAL'));
});
