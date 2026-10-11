import {createHash,randomUUID} from 'node:crypto';
import {fields,text,requireValue} from './operations-errors.mjs';

const requiredFields=['loadReference','shipper','consignee','commodity','weightLb','pickupLocation','deliveryLocation'];
const fieldKeys=Object.fromEntries(requiredFields.map(key=>[key.toLowerCase(),key]));
const fingerprint=value=>createHash('sha256').update(value).digest('hex');
const normalized=value=>String(value??'').trim().replace(/\s+/g,' ').toLowerCase();
export function parseDocumentContent(content,mimeType,requestedType,load){
 const values=Object.create(null);
 if(mimeType==='application/json'){
  let parsed;
  try{parsed=JSON.parse(content)}catch{requireValue(false,'DOCUMENT_JSON','Document JSON is invalid.')}
  requireValue(parsed&&typeof parsed==='object'&&!Array.isArray(parsed),'DOCUMENT_JSON','Document JSON must be an object.');
  for(const key of requiredFields)if(Object.hasOwn(parsed,key)){
   const value=parsed[key];requireValue(typeof value==='string'||typeof value==='number','DOCUMENT_FIELD','Extracted fields must be text or numbers.');
   requireValue(String(value).length<=300,'DOCUMENT_FIELD','Extracted field is too long.');values[key]=value;
  }
 }else{
  for(const line of content.split(/\r?\n/)){
   const match=line.match(/^\s*([a-zA-Z ]+)\s*:\s*(.*?)\s*$/);
   if(!match)continue;const key=fieldKeys[match[1].replace(/ /g,'').toLowerCase()];
   if(key){requireValue(!Object.hasOwn(values,key),'DOCUMENT_FIELD','Document has ambiguous duplicate fields.');requireValue(match[2].length<=300,'DOCUMENT_FIELD','Extracted field is too long.');values[key]=match[2];}
  }
 }
 const detectedType=Object.hasOwn(values,'loadReference')&&Object.hasOwn(values,'shipper')&&Object.hasOwn(values,'consignee')||/\bbill\s+of\s+lading\b/i.test(content)?'BOL':'other';
 const type=requestedType==='auto'?detectedType:requestedType;
 const missing=type==='BOL'?requiredFields.filter(key=>!String(values[key]??'').trim()):[];
 const mismatches=[];
 if(type==='BOL'){
  for(const key of ['loadReference','commodity'])if(values[key]!==undefined&&normalized(values[key])!==normalized(load[key==='loadReference'?'reference':key]))mismatches.push(key);
  if(values.weightLb!==undefined&&(!/^\d+$/.test(String(values.weightLb))||Number(values.weightLb)!==load.weightLb))mismatches.push('weightLb');
  if(values.pickupLocation!==undefined&&normalized(values.pickupLocation)!==normalized(load.stops.find(s=>s.type==='pickup')?.location))mismatches.push('pickupLocation');
  if(values.deliveryLocation!==undefined&&normalized(values.deliveryLocation)!==normalized(load.stops.filter(s=>s.type==='delivery').at(-1)?.location))mismatches.push('deliveryLocation');
 }
 return {type,classification:{source:'deterministic-content-parser',version:'1',detectedType,declaredType:requestedType,confidence:detectedType==='BOL'?'high':'low'},
  extraction:{source:'local-text-parser',version:'1',fields:values,missing,mismatches,confidence:type==='BOL'&&!missing.length&&!mismatches.length?'high':'low'}};
}
export function documentMetadata(record){
 return {kind:record.kind,id:record.id,tenantId:record.tenantId,version:record.version,loadId:record.loadId,type:record.type,mimeType:record.mimeType,status:record.status,
  contentHash:record.contentHash,byteLength:record.byteLength,lineageId:record.lineageId,revision:record.revision,previousDocId:record.previousDocId,
  processing:record.processing??null,classification:record.classification,extraction:{source:record.extraction.source,version:record.extraction.version,confidence:record.extraction.confidence,fieldNames:Object.keys(record.extraction.fields),missing:record.extraction.missing,mismatches:record.extraction.mismatches},
  createdAt:record.createdAt,reviewedAt:record.reviewedAt??null,reviewedBy:record.reviewedBy??null,reviewNeeded:record.status==='pending_review'};
}
function latestDocuments(ops,actor,loadId){
 const documents=ops.store.list('document',actor.tenantId).filter(d=>d.loadId===loadId);
 const previous=new Set(documents.map(d=>d.previousDocId).filter(Boolean));
 return documents.filter(d=>!previous.has(d.id));
}
export function readDocument(ops,actor,id){
 actor=ops.actor(actor.id);
 const document=ops.read('document',id,actor),load=ops.read('load',document.loadId,actor,'document:view');
 if(actor.role==='customer')requireValue(document.type==='BOL'&&document.status==='validated'&&latestDocuments(ops,actor,load.id).some(d=>d.id===document.id),'DOCUMENT_ACCESS','This document is not available.',403);
 ops.store.audit(actor,'document:read',document.id,'success',{loadId:load.id,contentHash:document.contentHash},ops.now().toISOString());
 return {...documentMetadata(document),content:document.content,extractedFields:document.extraction.fields};
}
export function shippingDocumentReadiness(ops,actor,load){
 ops.guard(actor,'load:view',load);
 const documents=latestDocuments(ops,actor,load.id).filter(d=>d.type==='BOL'),issues=[];
 if(!documents.length)issues.push('MISSING_BOL');
 if(documents.some(d=>d.status!=='validated'))issues.push('BOL_REVIEW_REQUIRED');
 if(documents.some(d=>d.extraction.missing.length||d.extraction.mismatches.length))issues.push('BOL_INVALID');
 const pods=ops.store.list('pod',actor.tenantId).filter(p=>p.loadId===load.id&&p.recipientAcknowledged===true);
 if(load.stops.filter(s=>s.type==='delivery').some(s=>!pods.some(p=>p.stopId===s.id)))issues.push('MISSING_POD');
 return {ready:issues.length===0,issues,documentIds:documents.map(d=>d.id),podIds:pods.map(p=>p.id)};
}
function scan(ops,actor,load){
 const latest=latestDocuments(ops,actor,load.id).filter(d=>d.type==='BOL'),issues=[];
 if(!latest.length)issues.push('MISSING_BOL');
 if(latest.some(d=>d.status==='pending_review'))issues.push('BOL_REVIEW_REQUIRED');
 if(latest.some(d=>d.status==='rejected'))issues.push('BOL_REJECTED');
 if(latest.some(d=>d.extraction.missing.length))issues.push('BOL_REQUIRED_FIELDS');
 if(latest.some(d=>d.extraction.mismatches.length))issues.push('BOL_MISMATCH');
 if(load.status==='delivered'&&shippingDocumentReadiness(ops,actor,load).issues.includes('MISSING_POD'))issues.push('MISSING_POD');
 const current=ops.store.list('documentexception',actor.tenantId).find(e=>e.loadId===load.id&&e.status==='open');
 const at=ops.now().toISOString(),escalation=issues.some(x=>['BOL_REJECTED','BOL_MISMATCH','MISSING_POD'].includes(x))?'carrier':'dispatcher';
 if(!issues.length){if(current)return ops.change(actor,current,{status:'resolved',issueCodes:[],resolvedAt:at},'documentexception:resolve','Current shipping document evidence passed validation.');return {loadId:load.id,status:'clear',issueCodes:[]};}
 if(current){
  if(JSON.stringify(current.issueCodes)===JSON.stringify(issues)&&current.escalation===escalation)return current;
  return ops.change(actor,current,{issueCodes:issues,escalation,updatedAt:at},'documentexception:update','Current shipping document evidence requires review.');
 }
 return ops.create(actor,'documentexception',{loadId:load.id,status:'open',issueCodes:issues,escalation,createdAt:at,resolvedAt:null},'documentexception:create');
}
export function createDocumentExtensions({extract=parseDocumentContent}={}){
 return {
  'document:ingest':(ops,actor,c)=>{
   const p=c.payload??{};fields(p,['type','mimeType','content','previousDocId']);
   const load=ops.read('load',c.resourceId,actor,'document:manage');ops.version(load,c.expectedVersion);
   requireValue(load.status!=='void','DOCUMENT_STATE','Voided shipments cannot accept documents.',409);
   requireValue(['BOL','other','auto'].includes(p.type),'DOCUMENT_TYPE','Select a supported document type.');
   requireValue(['text/plain','application/json'].includes(p.mimeType),'DOCUMENT_MIME','Use plain text or JSON; binary OCR is not configured.');
   requireValue(typeof p.content==='string'&&p.content.trim().length>0&&Buffer.byteLength(p.content,'utf8')<=32768&&!/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(p.content),'DOCUMENT_CONTENT','Use a nonempty text document of at most 32 KiB without control characters.');
   const parsed=extract(p.content,p.mimeType,p.type,load),latest=latestDocuments(ops,actor,load.id).find(d=>d.type===parsed.type);
   let previous=null;
   if(p.previousDocId!==undefined){
    previous=ops.read('document',p.previousDocId,actor);
    requireValue(previous.loadId===load.id&&previous.type===parsed.type,'DOCUMENT_LINK','Revision must belong to this shipment and document type.',409);
    requireValue(latest?.id===previous.id,'DOCUMENT_REVISION','Revise the latest document.',409);
   }else requireValue(!latest,'DOCUMENT_REVISION','A document of this type exists; create an explicit revision.',409);
   const contentHash=fingerprint(p.content);
   requireValue(!previous||previous.contentHash!==contentHash,'DOCUMENT_DUPLICATE','The new revision must contain changed content.',409);
   const id=randomUUID(),document=ops.store.insert('document',actor.tenantId,{id,loadId:load.id,...parsed,mimeType:p.mimeType,content:p.content,contentHash,byteLength:Buffer.byteLength(p.content,'utf8'),
    lineageId:previous?.lineageId??id,revision:(previous?.revision??0)+1,previousDocId:previous?.id??null,status:'pending_review',createdBy:actor.id,createdAt:ops.now().toISOString()});
   // The first revision's stable ID is the lineage; no document body is copied into an audit event.
   const result=documentMetadata(document);
   ops.store.audit(actor,c.action,document.id,'success',{document:result},ops.now().toISOString());scan(ops,actor,load);
   return result;
  },
  'document:review':(ops,actor,c)=>{
   const p=c.payload??{};fields(p,['decision','reason']);requireValue(['validate','reject'].includes(p.decision),'DOCUMENT_REVIEW','Choose validate or reject.');text(p.reason,300);
   const document=ops.read('document',c.resourceId,actor),load=ops.read('load',document.loadId,actor,'document:review');ops.version(document,c.expectedVersion);
   requireValue(document.status==='pending_review','DOCUMENT_STATE','This revision has already been reviewed.',409);
   requireValue(latestDocuments(ops,actor,load.id).some(d=>d.id===document.id),'DOCUMENT_REVISION','Only the latest document can be reviewed.',409);
   if(p.decision==='validate')requireValue(!document.extraction.missing.length&&!document.extraction.mismatches.length,'DOCUMENT_INVALID','Correct required or mismatched shipping fields before validation.',409);
   const updated=ops.store.update('document',document.id,actor.tenantId,document.version,{status:p.decision==='validate'?'validated':'rejected',reviewedAt:ops.now().toISOString(),reviewedBy:actor.id,reviewReason:p.reason.trim()});
   const result=documentMetadata(updated);
   ops.store.audit(actor,c.action,document.id,'success',{beforeStatus:document.status,afterStatus:updated.status,loadId:load.id,contentHash:document.contentHash,reasonRecorded:true},ops.now().toISOString());
   scan(ops,actor,load);return result;
  },
  'document:scan':(ops,actor,c)=>{
   fields(c.payload??{},[]);const load=ops.read('load',c.resourceId,actor,'document:review');ops.version(load,c.expectedVersion);return scan(ops,actor,load);
  },
  'pod:record':(ops,actor,c)=>{
   const p=c.payload??{};fields(p,['stopId','recipientAcknowledged','evidenceReference']);
   const load=ops.read('load',c.resourceId,actor,'pod:record');ops.version(load,c.expectedVersion);
   requireValue(['in_transit','delivered'].includes(load.status),'POD_STATE','Proof of delivery requires a shipment in transit or delivered.',409);
   const stop=load.stops.find(s=>s.id===p.stopId&&s.type==='delivery');requireValue(!!stop,'POD_STOP','Select a delivery stop on this shipment.');
   if(load.status==='in_transit')requireValue(load.stops.find(s=>!s.completedAt)?.id===stop.id,'STOP_ORDER','Record proof for the next scheduled delivery stop.',409);
   requireValue(p.recipientAcknowledged===true,'POD_ACKNOWLEDGMENT','Recipient acknowledgment is required.');
   const evidenceReference=text(p.evidenceReference,120);requireValue(!/[\r\n\x00-\x1F\x7F]/.test(evidenceReference),'POD_EVIDENCE','Evidence reference contains unsupported characters.');
   requireValue(!ops.store.list('pod',actor.tenantId).some(pod=>pod.loadId===load.id&&pod.stopId===stop.id),'POD_EXISTS','This stop already has immutable delivery evidence.',409);
   const at=ops.now().toISOString(),pod=ops.store.insert('pod',actor.tenantId,{loadId:load.id,stopId:stop.id,recipientAcknowledged:true,evidenceReference,recordedAt:at,recordedBy:actor.id});
   const completion=ops.store.insert('deliveryevent',actor.tenantId,{loadId:load.id,stopId:stop.id,podId:pod.id,type:'recipient_acknowledged',at,recordedBy:actor.id});
   ops.store.audit(actor,c.action,pod.id,'success',{loadId:load.id,stopId:stop.id,completionEventId:completion.id,recipientAcknowledged:true,evidenceHash:fingerprint(evidenceReference),recordedAt:at},at);
   scan(ops,actor,load);return pod;
  }
 };
}

export const documentIntegritySQL = `
 CREATE TRIGGER IF NOT EXISTS delivery_evidence_no_update BEFORE UPDATE ON resources WHEN OLD.kind IN ('pod','deliveryevent') BEGIN SELECT RAISE(ABORT,'Delivery evidence is immutable'); END;
 CREATE TRIGGER IF NOT EXISTS delivery_evidence_no_delete BEFORE DELETE ON resources WHEN OLD.kind IN ('pod','deliveryevent','document') BEGIN SELECT RAISE(ABORT,'Document evidence cannot be deleted'); END;
 CREATE TRIGGER IF NOT EXISTS document_content_immutable BEFORE UPDATE ON resources WHEN OLD.kind='document' AND (NEW.kind<>OLD.kind OR NEW.id<>OLD.id OR NEW.tenant_id<>OLD.tenant_id OR json_remove(NEW.data,'$.version','$.status','$.reviewedAt','$.reviewedBy','$.reviewReason')<>json_remove(OLD.data,'$.version','$.status','$.reviewedAt','$.reviewedBy','$.reviewReason')) BEGIN SELECT RAISE(ABORT,'Document content is immutable; create a revision'); END;
`;
