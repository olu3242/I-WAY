export class OpsError extends Error{
 constructor(status,code,message){super(message);this.status=status;this.code=code;}
}
export const reject=(status,code,message)=>{throw new OpsError(status,code,message)};
export function requireValue(ok,code,message,status=422){if(!ok)reject(status,code,message);}
export function fields(input,allowed){
 requireValue(input&&typeof input==='object'&&!Array.isArray(input),'INPUT','An object is required.');
 requireValue(Object.keys(input).every(k=>allowed.includes(k)),'FIELDS','Unsupported fields.');
}
export function text(value,max=120){
 requireValue(typeof value==='string'&&value.trim().length>0&&value.trim().length<=max,'TEXT','Enter a valid text value.');
 return value.trim();
}
export function integer(value,min=0,max=100000000){
 requireValue(Number.isSafeInteger(value)&&value>=min&&value<=max,'NUMBER','Enter a valid whole number.');
 return value;
}
export function utc(value){
 requireValue(typeof value==='string'&&/Z$/.test(value)&&Number.isFinite(Date.parse(value)),'TIME','Use a valid UTC timestamp.');
 return new Date(value).toISOString();
}
