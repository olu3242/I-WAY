import test from 'node:test';
import assert from 'node:assert/strict';
import {validateUatRoster} from '../server/operations-uat-workflow.mjs';
import {uatFixture,syntheticRoster,syntheticPassword} from './helpers/uat-fixture.mjs';
const passwordRoster=()=>syntheticRoster.map(e=>({...e,googleSubject:null}));
test('explicit password-only identities do not require fabricated Google subjects',()=>{
 assert.equal(validateUatRoster(passwordRoster()).length,4);
 for(const invalid of [undefined,'', ' ',42]){
  const rows=passwordRoster();rows[0].googleSubject=invalid;assert.throws(()=>validateUatRoster(rows),/BINDING_INCOMPLETE/);
 }
 const duplicate=passwordRoster();duplicate[0].googleSubject=duplicate[1].googleSubject='same-subject';assert.throws(()=>validateUatRoster(duplicate),/NOT_UNIQUE/);
});
test('password-only users can authenticate while Google admission remains denied',async()=>{
 const f=uatFixture({roster:passwordRoster()});
 try{
  const entry=await f.activate(3);
  const session=await f.workflow.passwordLogin({email:entry.email,password:syntheticPassword,network:'password-test'});
  assert.equal((await f.workflow.session(session.id)).role,'driver');
  await assert.rejects(f.workflow.googleSession(f.tokens(entry.userId)),/DENIED/);
 }finally{f.db.close();}
});
test('password-only privileged personas still require MFA',async()=>{
 const f=uatFixture({roster:passwordRoster()});
 try{
  const entry=await f.activate(0);
  const result=await f.workflow.passwordLogin({email:entry.email,password:syntheticPassword,network:'platform-test'});
  assert.equal(result.mfaRequired,true);assert.equal(result.id,undefined);
  const elevated=await f.workflow.completeMfa({pending:result.pending,code:'123456',network:'platform-mfa'});
  assert.equal((await f.workflow.session(elevated.id)).role,'platform');
 }finally{f.db.close();}
});
