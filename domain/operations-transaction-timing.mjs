// Bounded numeric transaction timing aggregation. No actor, tenant, payload or SQL collection.
const fields=['acquireMs','executeMs','finalizeMs'];
const pct=(values,p)=>values.length?[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.ceil(values.length*p)-1)]:null;
export function createTransactionTimingCollector({maxSamples=10000}={}){
 if(!Number.isSafeInteger(maxSamples)||maxSamples<1||maxSamples>100000)throw new RangeError('Invalid sample bound');
 const samples=[];let observed=0,committed=0,rolledBack=0,acquisitionFailures=0;
 return Object.freeze({
  record(sample){
   if(!sample||typeof sample.committed!=='boolean'||!fields.every(k=>typeof sample[k]==='number'&&Number.isFinite(sample[k])&&sample[k]>=0))return false;
   observed++;if(sample.committed)committed++;else if(sample.acquired===false)acquisitionFailures++;else rolledBack++;
   if(samples.length<maxSamples)samples.push(fields.map(k=>sample[k]));
   return true;
  },
  snapshot(){
   return {format:'iway-transaction-phase-diagnostics',version:1,observed,committed,rolledBack,acquisitionFailures,sampled:samples.length,truncated:observed>samples.length,rawSamples:samples.map(s=>[...s]),
    phases:Object.fromEntries(fields.map((field,index)=>[field,{p50Ms:pct(samples.map(s=>s[index]),.5),p95Ms:pct(samples.map(s=>s[index]),.95),p99Ms:pct(samples.map(s=>s[index]),.99),maxMs:samples.length?Math.max(...samples.map(s=>s[index])):null}]))};
  }
 });
}
