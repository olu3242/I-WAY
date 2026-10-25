import test from 'node:test';
import {durablePostgresFixture} from '../helpers/durable-uat-fixture.mjs';
import {runHostedLogisticsScenario} from '../helpers/hosted-logistics-scenario.mjs';
test('hosted HTTP logistics retain delivery, idempotency and tenant isolation after PostgreSQL restart',{timeout:240000},async t=>{
 const postgres=await durablePostgresFixture();
 t.after(()=>postgres.close());
 await runHostedLogisticsScenario(t,{postgres});
});
