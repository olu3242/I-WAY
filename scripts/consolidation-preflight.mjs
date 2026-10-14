#!/usr/bin/env node
// Read-only consolidation preflight. Never merges, pushes or deploys.
import {execFileSync} from 'node:child_process';
import {writeFileSync,mkdirSync} from 'node:fs';
const repo='origin';
const branches=[
'feat/iway-sop-b16-postgres-rls-certification',
'feat/enterprise-org-admin-foundation-20261013',
'feat/b267-b276-hosted-evidence-intake',
'feat/iway-support-knowledge-two-batches-20261013',
'work/b234-b243-integration-20261013',
'work/b244-b253-certification-remediation-remote',
'feat/ai-native-decision-plane',
'fix/iway-vercel-public-site'];
const run=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const result={schemaVersion:1,scope:'read-only-local-preflight',generatedAt:new Date().toISOString(),target:'integration/iway-full-consolidation-20261013',branches:[],errors:[],decision:'NO-GO'};
try {
  result.currentBranch=run('branch','--show-current');
  result.workingTreeClean=run('status','--porcelain').length===0;
  result.mainSha=run('rev-parse',repo+'/main');
  result.integrationSha=run('rev-parse',repo+'/'+result.target);
  if(!result.workingTreeClean)result.errors.push('WORKTREE_DIRTY');
  for(const branch of branches){
    try{
      const ref=repo+'/'+branch;
      const sha=run('rev-parse',ref);
      const counts=run('rev-list','--left-right','--count',repo+'/'+result.target+'...'+ref).split(/\s+/).map(Number);
      const alreadyIncluded=run('merge-base','--is-ancestor',ref,repo+'/'+result.target);
      result.branches.push({branch,sha,behind:counts[0],ahead:counts[1],alreadyIncluded:true});
    }catch(e){
      // merge-base --is-ancestor exits 1 when not an ancestor; distinguish from missing ref.
      try{
        const ref=repo+'/'+branch;
        const sha=run('rev-parse',ref);
        const counts=run('rev-list','--left-right','--count',repo+'/'+result.target+'...'+ref).split(/\s+/).map(Number);
        result.branches.push({branch,sha,behind:counts[0],ahead:counts[1],alreadyIncluded:false});
      }catch{result.errors.push('MISSING_BRANCH:'+branch)}
    }
  }
  result.errors.push('FULL_CERTIFICATION_NOT_EXECUTED');
}catch(e){result.errors.push('GIT_PREFLIGHT_FAILED:'+String(e.message).slice(0,200))}
const json=JSON.stringify(result,null,2)+'\n';
if(process.argv.includes('--out')){
  const path=process.argv[process.argv.indexOf('--out')+1];
  if(!path || path.startsWith('-'))throw Error('OUTPUT_PATH_REQUIRED');
  mkdirSync((await import('node:path')).dirname(path),{recursive:true});
  writeFileSync(path,json);
}
process.stdout.write(json);
process.exitCode=result.errors.some(e=>e.startsWith('GIT_')||e.startsWith('MISSING_BRANCH'))?2:0;
