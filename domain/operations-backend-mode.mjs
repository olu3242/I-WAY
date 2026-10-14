// Backend mode is descriptive only; it never grants production authorization.
import {operationsPostgresReadiness} from '../server/operations-postgres.mjs';
export function resolveBackendMode(mode,{postgresCertified=false}={}){
 if(mode==='local')return Object.freeze({engine:'sqlite',sync:true,certifiedForHosted:false});
 // A caller-supplied flag is insufficient: the engine integration must be
 // independently certified by the deployed implementation.
 if(mode==='hosted'&&postgresCertified===true&&operationsPostgresReadiness.engineIntegration==='CERTIFIED'&&operationsPostgresReadiness.rlsExecution==='CERTIFIED'&&operationsPostgresReadiness.hostedConnectionExecuted===true)return Object.freeze({engine:'postgresql',sync:false,certifiedForHosted:true});
 throw Object.assign(new Error('Hosted Operations engine is not certified'),{code:'OPERATIONS_BACKEND_NOT_READY'});
}
