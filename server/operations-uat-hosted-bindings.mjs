// Owner-approved database configuration only. No account creation, linking or invitations.
import {validateUatRoster} from './operations-uat-workflow.mjs';
const projectId='prj_7uof3CdmN1QvzKxETkXvHjlrLjVm';
const approved={platform:'oadeyemo306@gmail.com',carrier:'martin@tm88investments.com',fleet:'info@tm88investments.com',driver:'cassiomey@gmail.com'};
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export async function loadHostedUatBindings({pool}={}){
 try{
  const result=await pool.query('SELECT configuration FROM operations_engine_private.deployment_configuration WHERE project_id=$1 AND approved=true',[projectId]);
  if(result.rows.length!==1)throw Error();
  const config=result.rows[0].configuration;
  if(!config||Object.keys(config).sort().join(',')!=='platformNamespaceId,roster'||!uuid(config.platformNamespaceId))throw Error();
  const roster=validateUatRoster(config.roster);
  if(roster.some(entry=>entry.email!==approved[entry.role]||entry.role!=='platform'&&entry.tenantId===config.platformNamespaceId))throw Error();
  const carrier=roster.find(entry=>entry.role==='carrier'),fleet=roster.find(entry=>entry.role==='fleet'),driver=roster.find(entry=>entry.role==='driver');
  if(carrier.fleetId!==null||carrier.tenantId!==fleet.tenantId||carrier.tenantId!==driver.tenantId||fleet.fleetId!==driver.fleetId)throw Error();
  return Object.freeze({roster,platformNamespaceId:config.platformNamespaceId});
 }catch{throw Error('UAT_APPROVED_DEPLOYMENT_BINDINGS_REQUIRED');}
}
