import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {handoffPreflight,requiredUatNames} from '../scripts/uat-handoff-preflight.mjs';
test('real provisioning remains blocked and preflight emits names without supplied secret values',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../docs/security/uat-provisioning-manifest.json',import.meta.url)));
 const result=handoffPreflight({env:{DATABASE_URL:'sensitive-marker'},manifest});
 assert.equal(result.status,'BLOCKED');assert.equal(result.missingPreview.length,12);assert.equal(result.runtimeLogin.auth,'BLOCKED_MISSING_RESTRICTED_CREDENTIAL');assert.ok(!JSON.stringify(result).includes('sensitive-marker'));
});
test('matching variable names alone cannot certify identity provisioning or hosted access',()=>{
 const result=handoffPreflight({env:Object.fromEntries(requiredUatNames.map(n=>[n,'synthetic'])),previewNames:requiredUatNames,manifest:{testers:[]}});
 assert.equal(result.status,'BLOCKED');assert.equal(result.missingPreview.length,0);
});
