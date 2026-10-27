import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertDeploymentPolicy,assertPushAllowed,protectedBranch,protectedBranches} from '../scripts/guard-uat-push.mjs';
test('repository blocks this UAT branch automatic deployment while preserving public-only output',async()=>{
 assert.equal(assertDeploymentPolicy(JSON.parse(await readFile(new URL('../vercel.json',import.meta.url)))),true);
 for(const config of [{outputDirectory:'site/public'},{outputDirectory:'site/public',git:{deploymentEnabled:{[protectedBranch]:true}}},{outputDirectory:'site/public',git:{deploymentEnabled:{[protectedBranch]:false,'*':true}}},{outputDirectory:'docs',git:{deploymentEnabled:{[protectedBranch]:false}}}])assert.throws(()=>assertDeploymentPolicy(config));
});
test('opt-in push hook blocks all outgoing ref updates without any environment bypass',()=>{
 assert.equal(assertPushAllowed(''),true);
 for(const ref of ['refs/heads/'+protectedBranch,'refs/heads/main','refs/tags/v1'])assert.throws(()=>assertPushAllowed('local '+'a'.repeat(40)+' '+ref+' '+'b'.repeat(40)+'\n'));
});

test('every protected branch requires an explicit disabled deployment rule',async()=>{
 const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url)));
 for(const branch of protectedBranches){
  const missing=structuredClone(config);delete missing.git.deploymentEnabled[branch];assert.throws(()=>assertDeploymentPolicy(missing));
  const enabled=structuredClone(config);enabled.git.deploymentEnabled[branch]=true;assert.throws(()=>assertDeploymentPolicy(enabled));
 }
});
