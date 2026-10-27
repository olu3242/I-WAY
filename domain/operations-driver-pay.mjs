import {fields,text,integer,requireValue} from './operations-errors.mjs';
export function driverPayCalculation(model,terms,loads){
 requireValue(loads.length>0,'PAYROLL_LOADS','Completed source loads are required.');
 const amount=v=>integer(v,0,100000000),safe=n=>{requireValue(n<=BigInt(Number.MAX_SAFE_INTEGER),'AMOUNT','Pay exceeds the supported range.');return Number(n);};
 let cents=0n;
 if(model==='per_load'){fields(terms,['perLoadCents']);cents=BigInt(amount(terms.perLoadCents))*BigInt(loads.length);}
 else if(model==='percentage'){fields(terms,['shareBps','basis','roundingPolicy']);requireValue(terms.basis==='source_load_revenue'&&terms.roundingPolicy==='half_up_cent_v1','PAY_BASIS','Explicit source-revenue and rounding terms are required.');const revenue=loads.reduce((n,l)=>n+BigInt(l.revenueCents),0n);cents=(revenue*BigInt(integer(terms.shareBps,0,10000))+5000n)/10000n;}
 else if(model==='per_mile'){fields(terms,['centsPerMile','mileage','verificationReference']);text(terms.verificationReference,120);const rate=amount(terms.centsPerMile);requireValue(Array.isArray(terms.mileage)&&terms.mileage.length===loads.length&&new Set(terms.mileage.map(m=>m.loadId)).size===loads.length,'MILEAGE','Provide reviewed mileage once for each source load.');for(const row of terms.mileage){fields(row,['loadId','paidMiles']);requireValue(loads.some(l=>l.id===row.loadId),'MILEAGE','Mileage must reference a completed source load.');cents+=BigInt(integer(row.paidMiles,0,100000))*BigInt(rate);}}
 else if(['flat_weekly','salary'].includes(model)){fields(terms,['weeklyCents']);cents=BigInt(amount(terms.weeklyCents));}
 else if(model==='custom'){fields(terms,['lines']);requireValue(Array.isArray(terms.lines)&&terms.lines.length>0&&terms.lines.length<=20,'PAY_LINES','Provide one to twenty agreed pay lines.');const codes=new Set();for(const line of terms.lines){fields(line,['code','amountCents']);const code=text(line.code,40);requireValue(!codes.has(code),'PAY_LINES','Pay line codes must be unique.');codes.add(code);cents+=BigInt(amount(line.amountCents));}}
 else requireValue(false,'PAY_MODEL','Choose a supported pay model.');
 return {model,terms:structuredClone(terms),grossPayCents:safe(cents)};
}
