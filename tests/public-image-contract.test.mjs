import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validatePublicImages} from '../scripts/lib/public-image-contract.mjs';
function fixture(t,html){const dir=mkdtempSync(join(tmpdir(),'iway-public-images-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));mkdirSync(join(dir,'assets'));writeFileSync(join(dir,'assets','i-way-logo.svg'),'<svg/>');writeFileSync(join(dir,'index.html'),html);return dir;}
test('public build rejects renamed logo paths and case-only deployment breakage',t=>{
 const dir=fixture(t,'<img src="assets/Iway-logo.svg"><img src="assets/I-WAY-LOGO.svg">');
 assert.equal(validatePublicImages(dir).length,2);
});
test('public build validates existing local images without following external URLs',t=>{
 const dir=fixture(t,'<img src="assets/i-way-logo.svg?v=1"><img src="https://example.invalid/image.svg">');assert.deepEqual(validatePublicImages(dir),[]);
});
test('public image checks reject paths outside the public artifact',t=>{
 const dir=fixture(t,'<img src="../private.svg">');assert.equal(validatePublicImages(dir)[0].reason,'OUTSIDE_PUBLIC_ROOT');
});
