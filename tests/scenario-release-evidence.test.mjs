import test from 'node:test';
import assert from 'node:assert/strict';
import {assessScenarioRelease} from '../domain/scenario-release-evidence.mjs';
import {sha256} from '../domain/operations-certification.mjs';

const sourceHash='fixture-source';
const ids=['identity','persistence-isolation-workflow','integrations'];
const log=Buffer.from('# tests 2\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n');
function fixture(){
 const files={};
 const scenarios=ids.map(id=>{
  files[id+'.log']=log;
  return {id,status:'PASS',exitCode:0,logFile:id+'.log',logSha256:sha256(log)};
 });
 files['isolated-scenarios.json']=Buffer.from(JSON.stringify({schemaVersion:1,sourceHash,scope:'isolated-local',hostedExecuted:false,hostedDecision:'NO-GO',scenarios}));
 return {files,read:name=>{if(!(name in files)){const e=Error('missing');e.code='ENOENT';throw e;}return files[name];}};
}
test('B265: all three independently logged scenarios can pass locally only',()=>{
 const f=fixture(),result=assessScenarioRelease(sourceHash,f.read);
 assert.equal(result.status,'PASS');
 assert.equal(result.hostedDecision,'NO-GO');
 assert.equal(result.hostedExecuted,false);
 assert.match(result.sha256,/^[a-f0-9]{64}$/);
});
test('B265: missing manifest is not an executable success',()=>{
 const f=fixture();delete f.files['isolated-scenarios.json'];
 assert.equal(assessScenarioRelease(sourceHash,f.read).status,'NOT_EXECUTED');
});
test('B265: stale source and changed logs are rejected',()=>{
 const f=fixture();
 assert.throws(()=>assessScenarioRelease('different-source',f.read));
 f.files['identity.log']=Buffer.from('modified');
 assert.throws(()=>assessScenarioRelease(sourceHash,f.read));
});
test('B265: zero tests, skipped tests and forged PASS are rejected',()=>{
 for(const replacement of [
  '# tests 0\n# pass 0\n# fail 0\n# cancelled 0\n# skipped 0\n',
  '# tests 2\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 1\n',
  '# tests 2\n# pass 1\n# fail 1\n# cancelled 0\n# skipped 0\n'
 ]){
  const f=fixture(),report=JSON.parse(f.files['isolated-scenarios.json']);
  f.files['identity.log']=Buffer.from(replacement);
  report.scenarios[0].logSha256=sha256(f.files['identity.log']);
  f.files['isolated-scenarios.json']=Buffer.from(JSON.stringify(report));
  assert.throws(()=>assessScenarioRelease(sourceHash,f.read));
 }
});
test('B265: a removed scenario receipt cannot be silently promoted',()=>{
 const f=fixture(),report=JSON.parse(f.files['isolated-scenarios.json']);
 report.scenarios.pop();
 f.files['isolated-scenarios.json']=Buffer.from(JSON.stringify(report));
 assert.throws(()=>assessScenarioRelease(sourceHash,f.read));
});
