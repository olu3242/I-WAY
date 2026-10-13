import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mountSupportUI} from '../../site/public/assets/js/support-ui.js';
test('B15: frontend refuses to activate without a token provider',()=>{
 const status={textContent:''},panel={hidden:true};
 const documentRef={getElementById:id=>id==='support-status'?status:panel};
 assert.equal(mountSupportUI({documentRef}),false);
 assert.equal(panel.hidden,true);
 assert.match(status.textContent,/Sign in/);
});
test('B15: frontend includes accessible support forms and explicit status',async()=>{
 const html=await readFile(new URL('../../site/public/support.html',import.meta.url),'utf8');
 for(const marker of ['id="support-question"','id="support-ticket"','role="status"','aria-live="polite"','id="support-panel" hidden'])assert.ok(html.includes(marker),marker);
});
