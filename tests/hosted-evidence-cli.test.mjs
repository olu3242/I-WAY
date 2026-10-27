import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync,copyFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {evidenceFixture} from './helpers/hosted-evidence-fixture.mjs';
import {sourceFingerprint} from '../domain/operations-certification.mjs';
import {digest,canonical} from '../domain/hosted-evidence.mjs';
test('B256 operator dry run is offline; execution without operator-installed trust is blocked',()=>{
 const env={...process.env};delete env.IWAY_EVIDENCE_TRUST_ROOT;delete env.IWAY_EVIDENCE_TRUST_SHA256;
 const dry=spawnSync(process.execPath,['scripts/hosted-evidence.mjs','dry-run'],{encoding:'utf8',env});assert.equal(dry.status,0);const report=JSON.parse(dry.stdout);assert.equal(report.hostedExecuted,false);assert.equal(report.plan.length,7);
 const run=spawnSync(process.execPath,['scripts/hosted-evidence.mjs','execute','.'],{encoding:'utf8',env});assert.equal(run.status,2);assert.equal(JSON.parse(run.stderr).code,'PINNED_TRUST_NOT_PROVISIONED');
});
test('B256 CLI intake and inspection work with separately pinned operator trust',t=>{
 const f=evidenceFixture(t),inbox=join(f.root,'inbox'),trust=join(f.root,'trust');mkdirSync(inbox);mkdirSync(trust);mkdirSync(join(inbox,'artifacts'));
 const now=new Date().toISOString(),expires=new Date(Date.now()+3600000).toISOString();f.setNow(now);
 f.binding.sourceHash=sourceFingerprint(process.cwd());f.binding.gitSha=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim();
 for(const key of Object.values(f.policy.keys)){key.notBefore=new Date(Date.now()-60000).toISOString();key.expiresAt=expires}
 const config={tenant:f.binding.tenant,environment:f.binding.environment,keys:f.policy.keys,revokedAuthorizations:[],revokedAttestations:[],ledgerDigest:null};
 const raw=Buffer.from(canonical(config));writeFileSync(join(trust,'policy.json'),raw);
 const r=f.record({expiresAt:expires});copyFileSync(join(f.root,r.artifact.path),join(inbox,r.artifact.path));
 writeFileSync(join(inbox,'request.json'),JSON.stringify(f.request(r,null,'DRAFT',0)));
 const env={...process.env,IWAY_EVIDENCE_TRUST_ROOT:trust,IWAY_EVIDENCE_TRUST_SHA256:digest(raw)};
 const run=command=>spawnSync(process.execPath,['scripts/hosted-evidence.mjs',command,inbox,r.id],{encoding:'utf8',env});
 const intake=run('intake');assert.equal(intake.status,0,intake.stderr);assert.equal(JSON.parse(intake.stdout).state,'DRAFT');
 const inspect=run('inspect');assert.equal(inspect.status,0,inspect.stderr);assert.equal(JSON.parse(inspect.stdout).record.id,r.id);
});
