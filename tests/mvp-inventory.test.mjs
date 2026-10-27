import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inventoryMvp} from '../scripts/inventory-mvp-controls.mjs';
test('implemented MVP inventory matches current sources and never claims execution from discovery',()=>{
 const inventory=inventoryMvp(),saved=JSON.parse(readFileSync('docs/security/b591-mvp-inventory.json','utf8'));assert.deepEqual(saved,inventory);
 assert.equal(new Set(inventory.controls.map(c=>c.key)).size,inventory.controls.length);
 for(const key of ['action:load:accept','action:connector:retry','form:payment-record','navigation:loads','route:/uat/control'])assert.ok(inventory.controls.some(c=>c.key===key));
 assert.ok(inventory.controls.every(c=>c.verification==='NOT_CERTIFIED_BY_DISCOVERY'));
});

test('Windows CRLF and Linux LF checkouts produce the same committed inventory',()=>{
 const lf=path=>readFileSync(path,'utf8').replace(/\r\n/g,'\n');
 assert.deepEqual(inventoryMvp({readSource:path=>lf(path).replace(/\n/g,'\r\n')}),inventoryMvp({readSource:lf}));
});
