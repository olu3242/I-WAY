import test from 'node:test';
import assert from 'node:assert/strict';
import {coordinateIntegrationEvent} from '../lib/intelligence/integration-event-contract.mjs';

const base=()=>({
  tenantId:'tenant-a',eventId:'event-1',kind:'shipment.status_changed',
  resourceId:'load-1',resourceVersion:3,occurredAt:'2026-10-13T15:00:00.000Z',
  sourceApp:'driver',targetApp:'carrier',evidenceDigest:'a'.repeat(64)
});
test('B234: valid cross-app event is non-executing and immutable',()=>{
  const result=coordinateIntegrationEvent(base());
  assert.equal(result.status,'ELIGIBLE_FOR_ORCHESTRATION');
  assert.equal(result.executionReceipt,null);
  assert.equal(result.externalDelivery,false);
  assert.equal(Object.isFrozen(result),true);
});
test('B235: replay has stable identity; changed resource version does not',()=>{
  const a=coordinateIntegrationEvent(base()),b=coordinateIntegrationEvent(base());
  assert.equal(a.idempotencyKey,b.idempotencyKey);
  assert.notEqual(a.idempotencyKey,coordinateIntegrationEvent({...base(),resourceVersion:4}).idempotencyKey);
});
test('B234: disallow unknown, same-app and unauthorized event routes',()=>{
  for(const changes of [{kind:'unrecognized'}, {targetApp:'driver'}, {sourceApp:'platform'}, {targetApp:'unknown'}]){
    assert.throws(()=>coordinateIntegrationEvent({...base(),...changes}),/EVENT_ROUTE/);
  }
});
test('B235: invalid tenant, version, timestamp, digest and injected fields fail closed',()=>{
  for(const changes of [
    {tenantId:''},{tenantId:'../other'},{resourceVersion:0},
    {resourceVersion:1.2},{occurredAt:'tomorrow'},
    {occurredAt:'2026-02-30T00:00:00.000Z'},
    {evidenceDigest:'not-a-digest'},{credentials:'secret'}
  ]) assert.throws(()=>coordinateIntegrationEvent({...base(),...changes}));
});
test('B235: event input is not modified',()=>{
  const input=base(),copy=structuredClone(input);
  coordinateIntegrationEvent(input);
  assert.deepEqual(input,copy);
});
