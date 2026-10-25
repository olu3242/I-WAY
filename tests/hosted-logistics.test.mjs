import test from 'node:test';
import {runHostedLogisticsScenario} from './helpers/hosted-logistics-scenario.mjs';
test('hosted HTTP load creation, dispatch, delivery, retries and persona boundaries',runHostedLogisticsScenario);
