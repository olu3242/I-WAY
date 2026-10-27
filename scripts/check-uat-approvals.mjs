// Read-only preparation tooling. Does not grant approval or execute hosted actions.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export const approvalIds=Object.freeze(Array.from({length:12},(_,i)=>'A'+String(i+1).padStart(2,'0')));
const fields={status:'Status',target:'Exact target',change:'Intended change',owner:'Required owner',dependencies:'Dependencies',prerequisites:'Prerequisites',risks:'Security risks',verification:'Verification',rollback:'Rollback',decision:'Owner decision / approved SHA / expiry'};
const fail=code=>{throw Error(code);};
export function approvalDependencyOrder(actions){
 if(!Array.isArray(actions)||actions.length!==12||new Set(actions.map(a=>a.id)).size!==12||approvalIds.some(id=>!actions.some(a=>a.id===id)))fail('APPROVAL_IDS_INVALID');
 const map=new Map(actions.map(a=>[a.id,a])),state=new Map(),order=[];
 function visit(id){
  if(state.get(id)===1)fail('APPROVAL_DEPENDENCY_CYCLE');if(state.get(id)===2)return;
  const action=map.get(id);if(!action||!Array.isArray(action.dependsOn)||new Set(action.dependsOn).size!==action.dependsOn.length)fail('APPROVAL_DEPENDENCIES_INVALID');
  state.set(id,1);for(const dependency of action.dependsOn){if(!map.has(dependency))fail('APPROVAL_DEPENDENCIES_INVALID');visit(dependency);}
  state.set(id,2);order.push(id);
 }
 for(const id of approvalIds)visit(id);return order;
}
export function parsePendingApprovalDocument(markdown){
 if(typeof markdown!=='string'||markdown.length>200000)fail('APPROVAL_DOCUMENT_INVALID');
 const text=markdown.replaceAll('\r\n','\n'),headings=[...text.matchAll(/^## (.+)$/gm)],actions=[];
 for(let i=0;i<headings.length;i++){
  const match=/^(A\d+) — (.+)$/.exec(headings[i][1]);if(!match)continue;
  const [,id,title]=match,body=text.slice(headings[i].index+headings[i][0].length,headings[i+1]?.index??text.length),values={};
  for(const [key,label] of Object.entries(fields)){
   const prefix='**'+label+':** ',lines=body.split('\n').filter(line=>line.startsWith(prefix));
   if(lines.length!==1||!lines[0].slice(prefix.length).trim())fail('APPROVAL_FIELD_INVALID');values[key]=lines[0].slice(prefix.length).trim();
  }
  const required=!['A01','A02','A12'].includes(id);
  if(title!==(required?'Activation prerequisite':'Optional; not an activation prerequisite'))fail('APPROVAL_SCOPE_INVALID');
  if(values.status!=='BLOCKED_APPROVAL_REQUIRED'||values.decision!=='[TBC].')fail('OWNER_APPROVAL_MUST_BE_RECONCILED_SEPARATELY');
  const dependsOn=values.dependencies==='None'?[]:values.dependencies.split(/,\s*/);
  actions.push({id,required,status:values.status,target:values.target,change:values.change,owner:values.owner,dependsOn,prerequisites:values.prerequisites,risks:values.risks,verification:values.verification,rollback:values.rollback,ownerDecision:null,executed:false});
 }
 const dependencyOrder=approvalDependencyOrder(actions);
 return {schemaVersion:1,sourceSha256LF:createHash('sha256').update(text).digest('hex'),actions:approvalIds.map(id=>actions.find(a=>a.id===id)),dependencyOrder,dependencyEdges:actions.flatMap(a=>a.dependsOn.map(from=>({from,to:a.id}))),approvedOwnerActions:0,hostedMutationsAllowed:false};
}
export function buildUnexecutedHostedResults({scenarios,register,blockers}={}){
 // This creates a NEW unexecuted run; it never consumes local or historical
 // execution claims as evidence that a hosted action/test occurred.
 if(!register||register.approvedOwnerActions!==0||register.hostedMutationsAllowed!==false||register.actions?.some(a=>a.ownerDecision!==null||a.executed!==false||a.status!=='BLOCKED_APPROVAL_REQUIRED'))fail('APPROVAL_REGISTER_INVALID');
 approvalDependencyOrder(register.actions);
 if(!Array.isArray(blockers)||!blockers.length||blockers.some(b=>typeof b!=='string'||!b.trim()))fail('HOSTED_BLOCKERS_REQUIRED');
 const ids=Array.from({length:84},(_,i)=>'HOST-'+String(i+1).padStart(3,'0'));
 if(!Array.isArray(scenarios)||scenarios.length!==84||new Set(scenarios.map(c=>c.case)).size!==84||ids.some(id=>!scenarios.some(c=>c.case===id)))fail('HOSTED_CASE_IDS_INVALID');
 const allowed=['case','tester','persona','method','scenario','route_or_control','prerequisites','steps','expected'];
 const results=scenarios.map(c=>{
  for(const key of allowed)if(typeof c[key]!=='string'||!c[key])fail('HOSTED_CASE_FIELDS_INVALID');
  const requiredApprovals=c.requiredApprovals??register.actions.filter(a=>a.required).map(a=>a.id);
  if(!Array.isArray(requiredApprovals)||!requiredApprovals.length||requiredApprovals.some(id=>!approvalIds.includes(id)))fail('HOSTED_CASE_APPROVAL_INVALID');
  const requiredIdentityBindings=c.requiredIdentityBindings??[];
  if(!Array.isArray(requiredIdentityBindings)||requiredIdentityBindings.some(value=>typeof value!=='string'||!value.trim()))fail('HOSTED_IDENTITY_REQUIREMENTS_INVALID');
  return {...Object.fromEntries(allowed.map(key=>[key,c[key]])),requiredApprovals:[...new Set(requiredApprovals)],requiredIdentityBindings:[...requiredIdentityBindings],status:'BLOCKED',executed:false,blockedBy:[...blockers],sanitized_evidence:''};
 });
 return {schemaVersion:1,scope:'Hosted UAT; unexecuted approval-gated run',hostedExecuted:0,counts:{PASS:0,FAIL:0,BLOCKED:84,'NOT RUN':0},results,localEvidenceSubstituted:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const document=readFileSync(new URL('../docs/security/b761-b780-approval-matrix.md',import.meta.url),'utf8');
 const register=parsePendingApprovalDocument(document);
 console.log(JSON.stringify({status:'PASS_PENDING_REGISTER_VALIDATION_ONLY',sourceSha256LF:register.sourceSha256LF,actionIds:register.actions.map(a=>a.id),dependencyOrder:register.dependencyOrder,approvedOwnerActions:0,hostedMutationsAllowed:false}));
}
