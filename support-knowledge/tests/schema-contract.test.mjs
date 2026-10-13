import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../sql/sop-local-schema.sql',import.meta.url),'utf8');
test('SOP schema defines three private tenant scoped tables',()=>{
 for(const name of ['sop_articles','sop_tickets','sop_ticket_events']){
  assert.match(sql,new RegExp('CREATE TABLE IF NOT EXISTS iway_private\\.'+name+' \\('));
  assert.match(sql,new RegExp('ALTER TABLE iway_private\\.'+name+' ENABLE ROW LEVEL SECURITY'));
  assert.match(sql,new RegExp('ALTER TABLE iway_private\\.'+name+' FORCE ROW LEVEL SECURITY'));
 }
});
test('SOP schema does not grant public or client access',()=>{
 assert.doesNotMatch(sql,/\bGRANT\b/i);
 assert.doesNotMatch(sql,/\bCREATE POLICY\b/i);
 assert.match(sql,/REVOKE ALL ON SCHEMA iway_private FROM PUBLIC, anon, authenticated/);
});
test('SOP schema constrains ticket lifecycle and stores audit events',()=>{
 assert.match(sql,/CHECK \(status IN \('open','triaged','assigned','waiting_customer','resolved','closed'\)\)/);
 assert.match(sql,/ticket_id text NOT NULL REFERENCES iway_private.sop_tickets\(id\)/);
});
