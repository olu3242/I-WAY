import {PDFDocument} from 'pdfkit';
import {openSync} from 'fontkit';
import {fileURLToPath} from 'node:url';
import {earningsState} from '../domain/operations-earnings.mjs';
import {createHash} from 'node:crypto';
import {requireValue} from '../domain/operations-errors.mjs';
import {financialProjection} from '../domain/operations-settlements.mjs';
// Bundled licensed font only. Never parses a user-supplied font, HTML or URL.
const fontPath=fileURLToPath(new URL('../apps/operations/InterVariable.ttf',import.meta.url));
const font=openSync(fontPath);
export function renderTextPdf(title,lines){
 const text=[title,...lines].join('\n');requireValue(text.length<=60000,'PDF_SIZE','Report exceeds the text limit.');
 for(const char of text)if(!/[\r\n\t]/.test(char))requireValue(font.hasGlyphForCodePoint(char.codePointAt(0)),'PDF_GLYPH','The approved font cannot represent a source character. The original record is unchanged.');
 const doc=new PDFDocument({pdfVersion:'1.4',size:'LETTER',margin:48,font:fontPath,bufferPages:true,compress:true,info:{Title:'I-way '+title,Author:'I-way',CreationDate:new Date(0),ModDate:new Date(0)}});
 const rows=[];for(const paragraph of lines.flatMap(line=>String(line).replaceAll('\t','    ').split(/\r?\n/))){let line='';for(const char of String(paragraph)){const candidate=line+char;if(doc.fontSize(10).widthOfString(candidate)>516){rows.push(line);line=char;}else line=candidate;}rows.push(line);}
 requireValue(rows.length<=44*30,'PDF_SIZE','Report exceeds the page limit.');const count=Math.max(1,Math.ceil(rows.length/44));
 for(let page=0;page<count;page++){
  if(page)doc.addPage();doc.fillColor('#092448').fontSize(18).text('I-way | '+title,48,40,{width:516});doc.fillColor('#111827').fontSize(10);
  for(const [i,line]of rows.slice(page*44,page*44+44).entries())doc.text(line,48,82+i*14,{width:516,lineBreak:false});
  doc.fontSize(9).text('Source-backed record | Page '+(page+1)+' of '+count,48,746,{lineBreak:false});
 }
 doc.end();const bytes=doc.read();requireValue(Buffer.isBuffer(bytes)&&bytes.subarray(-6).toString()==='%%EOF\n','PDF_RENDER','PDF rendering failed.',503);return bytes;
}
const usd=n=>(n/100).toFixed(2)+' USD';
export function authorizedPdf(ops,actor,{type,id,period='all_time'}){
 actor=ops.actor(actor.id);
 requireValue(['statement','driverpay','shipping','invoice','earnings'].includes(type)&&typeof id==='string'&&/^[a-f0-9-]{36}$/i.test(id),'NOT_FOUND','PDF not found.',404);
 let source,lines=[],title;
 if(type==='earnings'){requireValue(actor.role==='driver'&&actor.id===id,'FORBIDDEN','Only your own earnings summary is available.',403);const summary=earningsState(ops,actor).earningsPeriods[period];requireValue(summary,'PERIOD','Choose an available period.');const rows=[...ops.store.list('settlement',actor.tenantId),...ops.store.list('driverpay',actor.tenantId)].filter(r=>[...summary.statementIds,...summary.driverPayIds].includes(r.id));title='Earnings summary';source={id:actor.id,version:createHash('sha256').update(JSON.stringify(rows.map(r=>[r.id,r.version]))).digest('hex')};lines=[summary.label,summary.basis,'Net payable: '+usd(summary.netCents),'Reimbursements: '+usd(summary.reimbursementCents),'Escrow contributions: '+usd(summary.escrowCents),...rows.map(r=>'Week '+r.week+' | '+usd(r.calculation?.netCents??r.netCents))];}
 else if(['statement','driverpay'].includes(type)){
  source=ops.read(type==='statement'?'settlement':'driverpay',id,actor);const safe=financialProjection(ops,actor,source);requireValue(source.status==='approved','PDF_APPROVAL','Only approved statements may be downloaded.',409);
  const calc=safe.calculation??safe;title='Approved pay statement';lines=['Pay week: '+safe.week,'Currency: USD','Status: approved (amount payable; no transfer represented)','Gross pay: '+usd(calc.grossPayCents??safe.netCents),'Reimbursements: '+usd(calc.reimbursementCents??0),...(calc.deductions??[]).map(d=>'Deduction '+d.code+': '+usd(d.amountCents)),'Escrow contribution: '+usd(calc.escrowCents??0),'Net payable: '+usd(calc.netCents??safe.netCents)];
 }else if(type==='shipping'){
  source=ops.read('load',id,actor,'document:view');requireValue(source.status!=='void','PDF_SOURCE','Voided loads have no current shipping summary.',409);title='Shipping summary';lines=['Reference: '+source.reference,'Cargo: '+source.commodity,'Weight: '+source.weightLb+' lb','Status: '+source.status,...source.stops.map((s,i)=>'Stop '+(i+1)+' '+s.type+': '+s.location+' | UTC '+s.at),'This summary is not a signed BOL, POD or original rate confirmation.'];
 }else{
  source=ops.read('invoice',id,actor);const load=ops.read('load',source.loadId,actor,actor.role==='customer'?'invoice:view':'billing:manage');requireValue(['issued','partially_paid','paid'].includes(source.status),'PDF_SOURCE','Only issued invoices may be downloaded.',409);title='Issued invoice';lines=['Invoice: '+source.invoiceReference,'Load: '+load.reference,'Status: '+source.status,'Total: '+usd(source.totalCents),'Outstanding: '+usd(source.outstandingCents),'Due: '+source.dueOn,'Payable to: '+source.billTo,'No payment transfer is represented by this document.'];
 }
 lines.push('Source: '+source.id,'Source version: '+source.version);const bytes=renderTextPdf(title,lines),sha256=createHash('sha256').update(bytes).digest('hex');
 ops.store.audit(actor,'pdf:download',source.id,'success',{type,sourceVersion:source.version,sha256,retention:'regenerate_from_authorized_source'},ops.now().toISOString());
 return {bytes,sha256,filename:type+'-'+id+'.pdf'};
}
