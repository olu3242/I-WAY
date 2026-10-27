import {earningsState} from './operations-earnings.mjs';
import {createOnboardingExtensions,onboardingState} from './operations-onboarding.mjs';
import {createExpenseExtensions,expenseState} from './operations-expenses.mjs';
import {createLoadWizardExtensions,loadWizardState} from './operations-load-wizard.mjs';
import {createMaintenanceExtensions,maintenanceState} from './operations-maintenance.mjs';
import {createSettlementExtensions,settlementState} from './operations-settlements.mjs';
import {createLifecycleExtensions} from './operations-lifecycle.mjs';
import{createIdentityExtensions}from'../server/operations-identity.mjs';
import{createIntegrationExtensions,integrationState}from'./operations-integration.mjs';
import{createProviderExtensions,providerState}from'./operations-provider.mjs';
import{createComplianceExtensions,complianceState}from'./operations-compliance.mjs';
import {createDocumentAdapterExtensions} from './operations-document-adapters.mjs';
import {createMeasurementExtensions,measurementState} from './operations-measurement.mjs';
import {workflowHealth} from '../server/operations-observability.mjs';
import {createAutomation,runWorkflowTick} from './operations-automation.mjs';
import {documentMetadata} from './operations-documents.mjs';
import {createBusinessExtensions,businessState,businessSummary,runNotificationTick} from './operations-business.mjs';
import {createIntelligenceExtensions,intelligenceState} from './operations-intelligence.mjs';
import {createRuntimeExtensions,runtimeState,runRuntimeTick} from './operations-runtime.mjs';
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
export function createOperationsFeatures(){return {extensions:{...createOnboardingExtensions(),...createExpenseExtensions(),...createLoadWizardExtensions(),...createMaintenanceExtensions(),...createSettlementExtensions(),...createLifecycleExtensions(),...createAutomation(),...createDocumentAdapterExtensions(),...createBusinessExtensions(),...createIntelligenceExtensions(),...createRuntimeExtensions(),...createMeasurementExtensions(),...createComplianceExtensions(),...createIdentityExtensions(),...createIntegrationExtensions(),...createProviderExtensions()},views:[earningsState,onboardingState,expenseState,loadWizardState,maintenanceState,settlementState,integrationState,providerState,complianceState,measurementState,workflowHealth,portalState,documentState,intelligenceState,(ops,actor,loads)=>{const state=runtimeState(ops,actor,loads);return {...state,connectorJobs:state.connectorjobs,agentDecisions:state.agentdecisions,connectorResults:state.connectorresults,governancePolicy:state.governancepolicies[0]??null}},(ops,actor,loads)=>{const state=businessState(ops,actor,loads);return {...state,notificationpreference:state.preferences[0]??null,analytics:businessSummary(ops,actor,loads)}}]};}
export async function runFeatureTick(ops){return runWorkflowTick(ops)+runNotificationTick(ops)+await runRuntimeTick(ops);}
