import {authorize,retrieveKnowledge} from "./access.mjs";
const SENSITIVE = new Set(["dispatch:assign","billing:change","permission:change","incident:close"]);
export function classifyIntent(message) {
 const m=String(message||"").toLowerCase();
 if (/emergency|crash|injur|unsafe|security breach/.test(m)) return "critical";
 if (/invoice|payment|settlement/.test(m)) return "billing";
 if (/load|dispatch|assignment|trip/.test(m)) return "dispatch";
 if (/truck|vehicle|inspection|maintenance/.test(m)) return "fleet";
 if (/password|login|sign in|access/.test(m)) return "identity";
 return "general";
}
export function resolveSupportRequest({actor,message,articles=[],resource,now=new Date()}) {
 if (!actor?.id || !actor.tenantId) return {status:"denied",reason:"identity_required"};
 const intent=classifyIntent(message);
 if (intent==="critical") return {status:"escalate",priority:"P0",reason:"safety_or_security",intent};
 if (!resource || !authorize(actor,"knowledge:read",resource)) return {status:"denied",reason:"unauthorized_resource"};
 const matches=retrieveKnowledge(actor,articles,message,now);
 if (!matches.length) return {status:"escalate",priority:"P3",reason:"no_approved_source",intent};
 return {status:"answered",intent,answer:matches[0].body,citations:[{articleId:matches[0].id,version:matches[0].version,source:matches[0].source}]};
}
export function requestAgentAction({actor,action,resource,approval}) {
 if (!actor?.id || !resource || !authorize(actor,action,resource)) return {status:"denied"};
 if (SENSITIVE.has(action) && (!approval || approval.actorId===actor.id || approval.tenantId!==actor.tenantId || approval.status!=="approved")) return {status:"approval_required"};
 return {status:"proposed",action,requiresExecutionVerification:true};
}
