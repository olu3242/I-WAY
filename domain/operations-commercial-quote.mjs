// Pure commercial quote contract. No persistence, provider calls, or authorization.
// Callers must enforce trusted tenant identity, policy approval and atomic storage.
const fail=code=>{const error=new Error('Commercial quote rejected');error.code=code;throw error;};
const keys=(value,allowed)=>{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k)))fail('INVALID_FIELDS');
};
const identifier=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/.test(value);
const money=value=>Number.isSafeInteger(value)&&value>=0&&value<=100000000000;
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString()===value;
export function normalizeCommercialQuote(input){
 keys(input,['customerId','reference','currency','rateCents','charges','validUntil','notes']);
 if(!identifier(input.customerId)||!identifier(input.reference)||input.currency!=='USD'||!money(input.rateCents)||!date(input.validUntil))fail('INVALID_QUOTE');
 if(input.notes!==undefined&&(typeof input.notes!=='string'||input.notes.length>500))fail('INVALID_QUOTE');
 if(!Array.isArray(input.charges)||input.charges.length>20)fail('INVALID_CHARGES');
 const charges=input.charges.map(charge=>{
  keys(charge,['label','amountCents']);
  if(typeof charge.label!=='string'||!/^.{1,80}$/.test(charge.label)||!money(charge.amountCents))fail('INVALID_CHARGES');
  return {label:charge.label,amountCents:charge.amountCents};
 });
 const totalCents=charges.reduce((total,charge)=>total+charge.amountCents,input.rateCents);
 if(!Number.isSafeInteger(totalCents)||totalCents>100000000000)fail('INVALID_TOTAL');
 return Object.freeze({customerId:input.customerId,reference:input.reference,currency:'USD',rateCents:input.rateCents,
  charges:charges.map(c=>Object.freeze(c)),totalCents,validUntil:input.validUntil,notes:input.notes??''});
}
export function evaluateQuoteConversion({quote,actor,customer,now=new Date()}={}){
 if(!actor?.active||typeof actor.tenantId!=='string'||!actor.tenantId)fail('UNAUTHORIZED');
 if(!quote||quote.tenantId!==actor.tenantId||!customer||customer.tenantId!==actor.tenantId||
    customer.id!==quote.customerId||customer.active!==true)fail('FORBIDDEN');
 if(quote.status!=='approved'||quote.approvedBy===actor.id||!quote.approvedBy)fail('APPROVAL_REQUIRED');
 if(!date(quote.validUntil)||!Number.isFinite(now?.getTime?.())||Date.parse(quote.validUntil)<=now.getTime())fail('QUOTE_EXPIRED');
 if(!Number.isSafeInteger(quote.version)||quote.version<1)fail('INVALID_VERSION');
 const normalized=normalizeCommercialQuote({customerId:quote.customerId,reference:quote.reference,currency:quote.currency,rateCents:quote.rateCents,charges:quote.charges,validUntil:quote.validUntil,notes:quote.notes});
 if(normalized.totalCents!==quote.totalCents)fail('TOTAL_MISMATCH');
 return Object.freeze({eligible:true,quoteId:quote.id,quoteVersion:quote.version,tenantId:actor.tenantId,
  customerId:quote.customerId,rateCents:quote.rateCents,charges:normalized.charges,totalCents:normalized.totalCents});
}
