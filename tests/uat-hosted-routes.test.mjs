import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const config=JSON.parse(await readFile(new URL('../deploy/uat-staging/vercel.json',import.meta.url),'utf8'));
const route=path=>config.routes.find(rule=>new RegExp(rule.src).test(path));
test('isolated hosted manifest routes authenticated offline dependencies into the application',()=>{
 for(const path of ['/offline','/driver-sw.js','/domain/driver-offline-replay.mjs','/app','/admin','/portal','/uat/login','/auth/callback','/api/ops/commands','/api/ops/state'])assert.equal(route(path)?.dest,'/api/index',path);
});
test('offline routes do not expose arbitrary domain, server, internal or public-site files',()=>{
 for(const path of ['/domain/operations.mjs','/domain/driver-offline-replayXmjs','/driver-swXjs','/server/operations-store.mjs','/docs/PRD.md','/reference/figma-make-prototype/','/.env','/site/public/index.html','/offline/extra'])assert.equal(route(path)?.status,404,path);
 assert.equal(config.git.deploymentEnabled,false);assert.equal(config.outputDirectory,'public');
});
