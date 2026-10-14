const ACTIONS = Object.freeze({
 driver:["knowledge:read","ticket:create","shipment:read:self"],
 owner_operator:["knowledge:read","ticket:create","shipment:read:self"],
 dispatcher:["knowledge:read","ticket:create","shipment:read:tenant","dispatch:recommend"],
 carrier_admin:["knowledge:read","ticket:create","shipment:read:tenant"],
 carrier_operations:["knowledge:read","ticket:create","shipment:read:tenant","dispatch:recommend"],
 fleet_manager:["knowledge:read","ticket:create","fleet:read:tenant"],
 fleet_admin:["knowledge:read","ticket:create","fleet:read:tenant"],
 fleet_compliance:["knowledge:read","ticket:create","fleet:read:tenant"],
 shipper:["knowledge:read","ticket:create","shipment:read:self"],
 finance:["knowledge:read","ticket:create","billing:read:tenant"],
 support:["knowledge:read","ticket:triage"],
 platform_operations:["knowledge:read","ticket:triage"],
 security:["knowledge:read","ticket:triage"],
 platform_admin:["knowledge:read","ticket:triage"]
});
export function authorize(actor, action, resource) {
 if (!actor || !actor.id || !actor.tenantId || !ACTIONS[actor.role]?.includes(action)) return false;
 if (!resource || !resource.tenantId || resource.tenantId!==actor.tenantId) return false;
 if (action.endsWith(":self") && resource.ownerId!==actor.id) return false;
 if (resource.allowedRoles && !resource.allowedRoles.includes(actor.role)) return false;
 return true;
}
export function canRetrieveArticle(actor, article, now = new Date()) {
 if (!authorize(actor,"knowledge:read",article)) return false;
 if (article.status!=="approved" || article.approvedBy===article.authoredBy || !article.approvedBy) return false;
 if (article.effectiveAt && new Date(article.effectiveAt)>now) return false;
 if (article.expiresAt && new Date(article.expiresAt)<=now) return false;
 return true;
}
export function retrieveKnowledge(actor, articles, query, now = new Date()) {
 const tokens=String(query||"").toLowerCase().split(/\W+/).filter(t=>t.length>2);
 return articles.filter(a=>canRetrieveArticle(actor,a,now))
 .map(a=>({article:a,score:tokens.reduce((n,t)=>n+(String(a.title+" "+a.body).toLowerCase().includes(t)?1:0),0)}))
 .filter(x=>x.score>0).sort((a,b)=>b.score-a.score)
 .map(x=>({id:x.article.id,version:x.article.version,title:x.article.title,body:x.article.body,source:x.article.source}));
}
