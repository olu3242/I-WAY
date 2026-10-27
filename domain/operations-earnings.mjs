import {settlementState} from './operations-settlements.mjs';
import {payWeek} from './operations-automation.mjs';
export function earningsState(ops,actor){
 if(actor.role!=='driver')return {earningsPeriods:{}};
 const {settlements,driverpay}=settlementState(ops,actor),rows=[...settlements,...driverpay],today=ops.localDate(actor),year=today.slice(0,4),month=today.slice(0,7),week=payWeek(today+'T12:00:00Z','UTC'),lastWeek=new Date(Date.parse(week+'T12:00:00Z')-7*86400000).toISOString().slice(0,10),lastMonth=new Date(Date.UTC(Number(year),Number(today.slice(5,7))-2,15)).toISOString().slice(0,7);
 const definitions=[['current_week','This week',r=>r.week===week],['last_week','Last week',r=>r.week===lastWeek],['month_to_date','Month to date',r=>r.week.startsWith(month)&&r.week<=today],['last_month','Last month',r=>r.week.startsWith(lastMonth)],['year_to_date','Year to date',r=>r.week.startsWith(year)&&r.week<=today],['all_time','All time',()=>true],...[...new Set(rows.map(r=>r.week.slice(0,4)))].sort().map(y=>['annual_'+y,'Annual '+y,r=>r.week.startsWith(y)])];
 const earningsPeriods={};for(const [key,label,filter]of definitions){const selected=rows.filter(filter);earningsPeriods[key]={label,basis:'Pay-week start date in carrier time zone; not payment receipt date',statementIds:selected.filter(r=>r.kind==='settlement').map(r=>r.id),driverPayIds:selected.filter(r=>r.kind==='driverpay').map(r=>r.id),netCents:selected.reduce((n,r)=>n+r.netCents,0),reimbursementCents:selected.reduce((n,r)=>n+(r.reimbursementCents??0),0),escrowCents:selected.reduce((n,r)=>n+(r.escrowCents??0),0)};}
 return {earningsPeriods};
}
