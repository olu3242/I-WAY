// PostgreSQL readiness is not equivalent to Operations command-engine parity.
export function resolveBackendMode(mode,{postgresCertified=false}={}){
 if(mode==='local')return Object.freeze({engine:'sqlite',sync:true,certifiedForHosted:false});
 if(mode==='hosted'&&postgresCertified===true)return Object.freeze({engine:'postgresql',sync:false,certifiedForHosted:true});
 throw Object.assign(new Error('Hosted Operations engine is not certified'),{code:'OPERATIONS_BACKEND_NOT_READY'});
}
