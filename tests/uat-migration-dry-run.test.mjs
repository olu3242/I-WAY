import test from 'node:test';
import assert from 'node:assert/strict';
import {guardedDryRunPlan} from '../scripts/uat-migration-dry-run.mjs';
import {uatProject,migrationNames,migrationManifest} from '../scripts/lib/recovery-v2.mjs';
const valid=()=>({linkedProject:uatProject,files:migrationNames,manifest:migrationManifest('supabase/migrations'),approved:migrationManifest('supabase/migrations')});
test('B941 migration command can only request the exact UAT dry-run with Vault mutation disabled',()=>{
 const args=guardedDryRunPlan(valid());assert.deepEqual(args,['db','push','--project-ref',uatProject,'--dry-run','--skip-vault']);assert.ok(!args.includes('--db-url'));assert.ok(!args.includes('--include-all'));
});
test('B941 public, unrelated and missing project links fail before CLI authentication',()=>{
 for(const linkedProject of ['vnoxdinldneeczxibicp','otherproject',''])assert.throws(()=>guardedDryRunPlan({...valid(),linkedProject}),/EXACT_UAT_LINK/);
});
test('B941 added, missing or substituted migration files cannot enter the dry-run',()=>{
 for(const files of [[...migrationNames,'20261029000000_unreviewed.sql'],migrationNames.slice(1),['20261011055816_unreviewed.sql',...migrationNames.slice(1)]])assert.throws(()=>guardedDryRunPlan({...valid(),files}),/EIGHT/);
});
test('B941 a changed or reordered reviewed migration fails its hash gate',()=>{
 for(const mutate of [a=>a[0].lfSha256='0'.repeat(64),a=>a.reverse()]){const input=valid();mutate(input.manifest);assert.throws(()=>guardedDryRunPlan(input),/HASH/);}
});
