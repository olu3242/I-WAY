import {authorize} from "./access.mjs";
export const PRIORITY = Object.freeze({P0:"immediate",P1:"15_minutes",P2:"1_hour",P3:"4_business_hours",P4:"1_business_day"});
const ALLOWED={open:["triaged"],triaged:["assigned"],assigned:["waiting_customer","resolved"],waiting_customer:["assigned"],resolved:["closed","assigned"],closed:[]};
export function createTicket({actor,resource,subject,priority="P3",clock=()=>new Date()}) {
 if (!authorize(actor,"ticket:create",resource) || !String(subject||"").trim() || !PRIORITY[priority]) return {status:"denied"};
 return {status:"open",tenantId:actor.tenantId,requesterId:actor.id,subject:String(subject).slice(0,300),priority,createdAt:clock().toISOString(),history:[]};
}
export function transitionTicket(ticket,next,{actor,clock=()=>new Date(),note=""}) {
 if (!ticket || !authorize(actor,"ticket:triage",{tenantId:ticket.tenantId}) || !ALLOWED[ticket.status]?.includes(next)) return {status:"denied"};
 return {...ticket,status:next,history:[...ticket.history,{from:ticket.status,to:next,actorId:actor.id,at:clock().toISOString(),note:String(note).slice(0,500)}]};
}
