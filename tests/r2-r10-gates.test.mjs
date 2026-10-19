import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluate,report} from '../scripts/r2-r10-gates.mjs';
test('R2-R10 register has nine unique ordered gates and conservative release decision',()=>{
 const result=report();
 assert.deepEqual(result.gates.map(g=>g.id),Array.from({length:9},(_,i)=>'R'+(i+2)));
 assert.equal(result.decision,'NO-GO');
 assert.ok(result.gates.every(g=>g.status==='BLOCKED'&&g.remaining.length>0));
});
test('source inventory is explicit and does not certify missing external evidence',()=>{
 const result=evaluate();
 assert.ok(result.every(g=>typeof g.sourcePresent==='boolean'));
 assert.ok(result.every(g=>g.path&&!g.path.includes('..')));
});
