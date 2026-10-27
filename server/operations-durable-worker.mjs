// Called inside a verified tenant transaction after an authorized same-origin command.
// Work is local deterministic advice only: no timers, connector calls or provider inference.
import {claimJob,executeAdvisory,completeJob,failJob} from '../domain/operations-runtime.mjs';
import {runWorkflowTick} from '../domain/operations-automation.mjs';

export async function advanceDurableAdvisories(operations,{limit=5}={}){
 if(!Number.isInteger(limit)||limit<1||limit>5)throw new TypeError('Invalid bounded advisory count');
 const tenants=operations.store.db.prepare('SELECT id FROM tenants').all();
 if(tenants.length!==1)throw Error('SINGLE_TENANT_TRANSACTION_REQUIRED');
 const tenantId=tenants[0].id,now=operations.now().toISOString();
 const workflowProgress=runWorkflowTick(operations,{maxJobs:1,readyFirst:true});
 const job=operations.store.list('orchestration',tenantId).find(item=>item.status==='pending'||item.status==='retry'&&item.nextAttemptAt<=now||item.status==='running'&&item.leaseUntil<=now);
 let advisoryCheckpoints=0;
 if(job)for(let step=0;step<limit;step++){
  const claim=claimJob(operations,{tenantId,kind:'orchestration',jobId:job.id,workerId:'durable-command-checkpoint'});
  if(!claim)break;
  try{
   const output=executeAdvisory(operations,claim);
   const result=completeJob(operations,claim,output);
   if(!result.accepted)break;
   advisoryCheckpoints++;
   if(result.job.status==='completed')break;
  }catch(error){failJob(operations,claim,error);break;}
 }
 return {workflowProgress,advisoryCheckpoints,externalCalls:0};
}
