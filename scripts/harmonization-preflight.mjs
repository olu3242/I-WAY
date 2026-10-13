#!/usr/bin/env node
// B224-B233 read-only, token-efficient repository harmonization preflight.
// Never reads .env files or connects to hosted services.
import {execFileSync} from 'node:child_process';
import {writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const branch=git('branch','--show-current');
const baseline=git('rev-parse','HEAD');
const changed=git('status','--porcelain').split('\n').filter(Boolean);
const paths=git('ls-files').split('\n').filter(Boolean);
const scopes={
  B224:['load','dispatch','workflow'],
  B225:['decision','dispatch','policy'],
  B226:['driver','task','load'],
  B227:['fleet','vehicle','equipment'],
  B228:['document','evidence','pod','bol'],
  B229:['exception','alert','incident'],
  B230:['approval','human','review'],
  B231:['command','dashboard','operations'],
  B232:['agent','decision','guard','policy'],
  B233:['test','certif','benchmark','accessibility']
};
const evidence=Object.entries(scopes).map(([batch,terms])=>{
 const matches=paths.filter(path=>terms.some(term=>path.toLowerCase().includes(term)));
 return {batch,status:'UNASSESSED',candidateFiles:matches.slice(0,25),additionalMatches:Math.max(0,matches.length-25),
   harmonization:'PENDING',tests:'NOT_RUN',commit:null};
});
const report={schemaVersion:1,branch,baseline,worktreeDirty:changed.length>0,
 changedPathCount:changed.length,trackedPathCount:paths.length,
 scope:'LOCAL_ONLY',hostedAuthentication:'BLOCKED_28P01',production:'NO_GO',
 caveat:'Filename matches are discovery hints, not proof of implementation or coverage.',
 batches:evidence};
const output='docs/certification/b224-b233/execution-state.json';
mkdirSync(dirname(output),{recursive:true});
writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,branch,baseline,dirty:report.worktreeDirty,
 tracked:paths.length,batches:evidence.length,hosted:'NOT_TOUCHED'}));
