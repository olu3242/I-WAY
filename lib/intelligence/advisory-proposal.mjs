// Pure fail-closed boundary. Provider output never grants execution authority.
const actions=new Set(['review_dispatch','review_tracking','review_documents','review_exceptions','review_finance']);
const identifier=v=>typeof v==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(v);
export function validateAdvisoryProposal(context,proposal){
 const deny=reason=>({status:'BLOCKED',reason,executionAuthorized:false});
 if(!context||!identifier(context.tenantId)||!identifier(context.eventId)||!actions.has(context.action)||!Array.isArray(context.authorizedEvidenceIds))return deny('INVALID_CONTEXT');
 if(!proposal||typeof proposal!=='object'||Array.isArray(proposal))return deny('INVALID_PROPOSAL');
 if(Object.keys(proposal).some(k=>!['action','confidence','estimatedCost','evidenceIds','summary'].includes(k)))return deny('UNEXPECTED_FIELD');
 if(proposal.action!==context.action)return deny('ACTION_MISMATCH');
 if(typeof proposal.summary!=='string'||!proposal.summary.trim()||proposal.summary.length>2000)return deny('INVALID_SUMMARY');
 if(!Array.isArray(proposal.evidenceIds)||!proposal.evidenceIds.length||proposal.evidenceIds.length>30||!proposal.evidenceIds.every(identifier)||new Set(proposal.evidenceIds).size!==proposal.evidenceIds.length)return deny('INVALID_EVIDENCE');
 if(!proposal.evidenceIds.every(id=>context.authorizedEvidenceIds.includes(id)))return deny('UNAUTHORIZED_EVIDENCE');
 if(!Number.isFinite(proposal.confidence)||proposal.confidence<0||proposal.confidence>1||!Number.isFinite(proposal.estimatedCost)||proposal.estimatedCost<0)return deny('INVALID_MEASUREMENT');
 if(context.confidenceVerified!==true||context.costVerified!==true)return deny('MEASUREMENTS_UNVERIFIED');
 return {status:'VALIDATED_ADVISORY',tenantId:context.tenantId,eventId:context.eventId,action:context.action,confidence:proposal.confidence,estimatedCost:proposal.estimatedCost,evidence:[...proposal.evidenceIds],summary:proposal.summary,executionAuthorized:false};
}
