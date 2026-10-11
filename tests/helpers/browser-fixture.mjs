// Isolated, clearly labelled browser fixture. Never loads environment or hosted credentials.
import {fixture} from './operations-fixture.mjs';
import {makeOperationsApp} from '../../server/operations-app.mjs';
import {runWorkflowTick} from '../../domain/operations-automation.mjs';
const cleanup=[];const f=await fixture({after:fn=>cleanup.push(fn)});
f.createLoad();
const fleetDriver=f.command(f.fleetUser,'driver:create',null,{name:'Illustrative Fleet Driver',username:'fleetdriver@illustrative.invalid',password:'illustrative-fixture-only-47'});
f.command(f.fleetUser,'vehicle:create',null,{name:'Illustrative Fleet Truck',capacityLb:40000});
const server=makeOperationsApp({store:f.store,operations:f.ops});
await new Promise(r=>server.listen(4181,'127.0.0.1',r));
const worker=setInterval(()=>{try{runWorkflowTick(f.ops)}catch{console.error('Fixture checkpoint deferred')}},1000);
console.log('Isolated illustrative browser fixture: http://127.0.0.1:4181');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{clearInterval(worker);server.close(async()=>{for(const fn of cleanup)await fn();process.exit(0)})});
