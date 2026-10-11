import {createAutomation,runWorkflowTick} from './operations-automation.mjs';
import {createDocumentExtensions,documentMetadata} from './operations-documents.mjs';
import {createBusinessExtensions,businessState,businessSummary,runNotificationTick} from './operations-business.mjs';
import {portalState} from './operations-portal.mjs';
import {authorize} from './authorization.mjs';
export function documentState(ops,actor,loads){
 const visible=new Set(loads.filter(l=>authorize({actor,action:'document:view',resource:ops.read('load',l.id,actor)})).map(l=>l.id));
 const all=ops.store.list('document',actor.tenantId),previous=new Set(all.map(d=>d.previousDocId).filter(Boolean));
 return {
  documents:all.filter(d=>visible.has(d.loadId)&&(actor.role!=='customer'||d.type==='BOL'&&d.status==='validated'&&!previous.has(d.id))).map(documentMetadata),
  pods:ops.store.list('pod',actor.tenantId).filter(p=>visible.has(p.loadId)).map(p=>({kind:p.kind,id:p.id,version:p.version,loadId:p.loadId,stopId:p.stopId,recipientAcknowledged:p.recipientAcknowledged,recordedAt:p.recordedAt})),
  documentexceptions:['carrier','dispatcher'].includes(actor.role)&&actor.permissions.includes('document:review')?ops.store.list('documentexception',actor.tenantId).filter(e=>visible.has(e.loadId)):[],
 };
}
export function createOperationsFeatures(){return {extensions:{...createAutomation(),...createDocumentExtensions(),...createBusinessExtensions()},views:[portalState,documentState,(ops,actor,loads)=>{const state=businessState(ops,actor,loads);return {...state,notificationpreference:state.preferences[0]??null,analytics:businessSummary(ops,actor,loads)}}]};}
export function runFeatureTick(ops){return runWorkflowTick(ops)+runNotificationTick(ops);}
