const ReportDocuments=(()=>{
const C=BatchCore;
function bytes(s){const extra={'€':128,'’':146,'‘':145,'“':147,'”':148,'–':45,'—':45,'→':62,'…':46};return Uint8Array.from([...s].map(c=>c.codePointAt(0)<256?c.codePointAt(0):(extra[c]??63)));}
function pdfString(s){return [...bytes(String(s))].map(b=>b===40||b===41||b===92?'\\'+String.fromCharCode(b):b<32?' ':String.fromCharCode(b)).join('');}
function pdf(report,options={}){
 const pages=[],ink='0.12 0.20 0.24',teal='0.05 0.43 0.45',sand='0.76 0.49 0.25',muted='0.38 0.44 0.46',pale='0.94 0.97 0.97',gray='0.77 0.82 0.83';let commands=[];
 const text=(x,y,t,size=10,bold=false,color=ink)=>commands.push(`${color} rg BT /${bold?'F2':'F1'} ${size} Tf ${x} ${842-y} Td (${pdfString(t)}) Tj ET`);
 const rect=(x,y,w,h,color)=>commands.push(`${color} rg ${x} ${842-y-h} ${w} ${h} re f`);
 const line=(x,y,w)=>commands.push(`0.85 0.89 0.89 RG 0.6 w ${x} ${842-y} m ${x+w} ${842-y} l S`);
 const num=n=>n===null||n===undefined?'n.d.':C.number(n),money=n=>n===null||n===undefined?'n.d.':C.money(n),signed=n=>n===null?'n.d.':(n>0?'+':'')+num(n)+'%';
 // Conservative width estimate for Helvetica: fit every line to its available space.
 function width(s,size){return [...String(s)].reduce((n,c)=>n+(/[MW@%]/.test(c)?.88:/[ilI1 .,:;'!]/.test(c)?.28:/[A-Z0-9]/.test(c)?.65:.55),0)*size;}
 function fit(x,y,s,max,size=10,bold=false,color=ink){text(x,y,s,Math.min(size,max/Math.max(width(s,1),1)),bold,color)}
 function wrap(s,maxWidth,size=10){const out=[];let a='';for(const word of String(s).split(/\s+/)){if(width((a?a+' ':'')+word,size)>maxWidth&&a){out.push(a);a=word}else a+=(a?' ':'')+word;}if(a)out.push(a);return out;}
 function para(x,y,s,w=491,size=10,color=ink){for(const t of wrap(s,w,size)){fit(x,y,t,w,size,false,color);y+=size*1.5}return y}
 function header(page,title,subtitle){rect(0,0,595,9,teal);text(42,37,'REPORTFLOW',11,true,teal);fit(280,37,options.studio||'Studio dimostrativo',273,9,false,muted);text(42,65,report.quarter+' / DATI FITTIZI / DA REVISIONARE',8,true,muted);fit(42,99,report.company,511,25,true);text(42,134,title,17,true);text(42,153,subtitle,9,false,muted);line(42,168,511);line(42,793,511);text(42,812,'Report dimostrativo | Definizioni e copertura: pagina 3',8,false,muted);text(519,812,page+' / 3',8,true,teal)}
 function card(x,y,w,label,value,detail){rect(x,y,w,81,pale);text(x+12,y+20,label,9,false,muted);fit(x+12,y+47,value,w-24,21,true,teal);fit(x+12,y+67,detail,w-24,8,false,muted)}
 function section(y,title,sub){text(42,y,title,12,true);if(sub)text(42,y+17,sub,8,false,muted)}
 function insight(y,title,body){rect(42,y,511,76,pale);rect(42,y,3,76,teal);text(55,y+21,title,10,true,teal);para(55,y+40,body,479,9)}
 const r=report,compared=r.prior!==null;
 header(1,'Il trimestre in sintesi','Le dimensioni principali, con un confronto omogeneo sul trimestre precedente.');
 card(42,188,248,'Costo del trimestre',money(r.total),compared?signed(r.percent)+' rispetto a '+r.reference:'Riferimento incompleto: confronto n.d.');
 card(305,188,248,'Costo trimestrale per FTE medio',money(r.costPerFte),'Costo totale / FTE medi del trimestre');
 card(42,281,160,'FTE medi',num(r.fteAverage),compared?signed(r.ftePercent)+' sul precedente':'Equivalenti a tempo pieno');
 card(217,281,160,'Persone a fine periodo',num(r.endPeople),'Ultimo mese: '+r.monthly[2].month);
 card(392,281,161,'Straordinari',num(r.overtime)+' h','Somma delle ore nei tre mesi');
 section(395,'Costo mensile: attuale e riferimento','Euro; mesi allineati per posizione nel trimestre, scala comune da zero.');
 const all=[...r.monthly,...(r.priorMonthly||[])].map(m=>m.cost),rawMax=Math.max(...all,1),power=10**Math.floor(Math.log10(rawMax)),max=Math.ceil(rawMax/power/0.5)*power*0.5;
 rect(92,429,9,6,teal);text(107,435,r.quarter,8,true,muted);if(r.priorMonthly){rect(234,429,9,6,gray);text(249,435,r.reference+' - riferimento',8,false,muted)}else text(234,435,'Riferimento non disponibile',8,false,muted);
 for(let i=0;i<=4;i++){const v=max*i/4,y=556-i*100/4;line(92,y,461);fit(42,y+3,v>=1000?num(v/1000)+'k':num(v),41,8,false,muted)}
 r.monthly.forEach((m,i)=>{const x=123+i*146,old=r.priorMonthly?.[i];if(old){const h=old.cost/max*100;rect(x,556-h,34,h,gray);fit(x-13,550-h,money(old.cost),64,7,false,muted)}const h=m.cost/max*100;rect(x+40,556-h,34,h,teal);fit(x+29,550-h,money(m.cost),69,8,true,teal);text(x+5,578,m.month,9,true);if(old)text(x+5,591,'rif. '+old.month,7,false,muted)});
 if(options.comments!==false){const body=compared?`Il costo varia del ${signed(r.percent)} e gli FTE medi del ${signed(r.ftePercent)}. Queste misure vanno lette insieme: i dati non permettono da soli di attribuire le cause della variazione.`:'Il trimestre target è completo. Mancano mesi del trimestre precedente: i confronti sono non disponibili, senza sostituire i valori mancanti con zero.';insight(615,'Come leggere il risultato',body)}
 para(42,715,'FTE: un dipendente a tempo pieno vale 1; un part-time al 50% vale 0,5. Il costo per FTE è riferito all’intero trimestre, non al singolo mese.',511,9,muted);
 pages.push(commands.join('\n'));commands=[];
 header(2,'Dove si concentra il costo','Importi, composizione e variazioni: le componenti non spiegano da sole le cause.');
 if(options.components!==false){section(199,'Le quattro componenti del costo','Importo target, quota sul totale e differenza rispetto al trimestre precedente.');
 let x=42;const colors=[teal,'0.29 0.47 0.65','0.57 0.67 0.74','0.83 0.64 0.41'];r.components.forEach((c,i)=>{const w=r.total?c.total/r.total*511:0;rect(x,231,w,19,colors[i]);x+=w});
 text(42,276,'COMPONENTE',8,true,muted);text(278,276,'IMPORTO',8,true,muted);text(391,276,'QUOTA',8,true,muted);text(458,276,'DIFFERENZA',8,true,muted);
 r.components.forEach((c,i)=>{const y=305+i*35;rect(42,y-9,7,7,colors[i]);text(56,y,c.name,10);fit(278,y,money(c.total),100,10,true);text(391,y,r.total?num(c.total/r.total*100)+'%':'n.d.',9);fit(458,y,c.change===null?'n.d.':(c.change>0?'+':'')+money(c.change),95,10);line(42,y+12,511)});
 }else{para(42,210,'Composizione del costo esclusa dal modello selezionato.',511,10,muted)}
 section(477,'Prima e dopo: costo complessivo','Il riferimento è '+r.reference+'. Barre sulla stessa scala, partendo da zero.');
 const cm=Math.max(r.total,r.prior||0,1);[['Riferimento',r.prior,gray],['Trimestre attuale',r.total,teal]].forEach(([label,value,color],i)=>{const y=514+i*40;text(42,y+13,label,9);if(value!==null)rect(155,y,265*value/cm,20,color);fit(437,y+14,money(value),116,10,true)});
 if(options.comments!==false){const largest=[...r.components].sort((a,b)=>Math.abs(b.change||0)-Math.abs(a.change||0))[0];insight(615,'La variazione da approfondire',compared?`${largest.name}: ${largest.change>0?'+':''}${money(largest.change)} rispetto al riferimento. È la componente con la maggiore variazione assoluta; non è una diagnosi delle cause.`:'Il riferimento è incompleto. Non vengono calcolate differenze tra componenti o tra totali.')} 
 para(42,729,'Costo = lordo corrente + contributi azienda + quota TFR + ratei maturati. Verificare che le voci dell’export non si sovrappongano.',511,9,muted);
 pages.push(commands.join('\n'));commands=[];
 header(3,'Persone e organizzazione del lavoro','Ore, presenza e distribuzione: indicatori descrittivi da contestualizzare.');
 card(42,188,160,'Incidenza assenze',num(r.absencePct)+'%','Ore assenza / ore teoriche');card(217,188,160,'Ferie residue a fine periodo',num(r.holidayEnd)+' h','Saldo dell’ultimo mese');card(392,188,161,'Variazione persone',compared?(r.endPeople-r.priorEndPeople>0?'+':'')+num(r.endPeople-r.priorEndPeople):'n.d.','Confronto tra fine trimestre');
 section(302,'Tre mesi, una lettura comune','Persone, FTE e ore: ogni colonna conserva la propria unità di misura.');
 const columns=[[42,'MESE'],[138,'PERSONE'],[227,'FTE'],[315,'ORE EXTRA'],[425,'ASSENZE %']];columns.forEach(([x,t])=>text(x,341,t,8,true,muted));
 r.monthly.forEach((m,i)=>{const y=367+i*28;[m.month,num(m.people),num(m.fte),num(m.overtime),m.hours?num(m.absence/m.hours*100)+'%':'n.d.'].forEach((v,j)=>text(columns[j][0],y,v,10,j===0));line(42,y+9,511)});
 section(478,'Distribuzione per reparto',options.departments!==false?'Costo trimestrale e FTE medi. Dettaglio completo nel CSV Reparti.':'Modulo reparti non selezionato.');
 if(options.departments!==false){const ds=[...r.departments].sort((a,b)=>b.cost-a.cost),top=ds.slice(0,4);if(ds.length>4){const rest=ds.slice(4);top.push({name:'Altri '+rest.length+' reparti',cost:rest.reduce((s,d)=>s+d.cost,0),fteAverage:rest.reduce((s,d)=>s+d.fteAverage,0)})}const dm=Math.max(...top.map(d=>d.cost),1);top.forEach((d,i)=>{const y=516+i*25;rect(207,y-9,150,11,'0.94 0.96 0.97');fit(42,y,d.name,155,9);rect(207,y-9,150*d.cost/dm,11,teal);fit(372,y,money(d.cost),96,9,true);fit(480,y,num(d.fteAverage)+' FTE',73,8)})}
 line(42,649,511);text(42,670,'METODO, COPERTURA E LIMITI',9,true,teal);
 para(42,690,'Target: 3 mesi presenti. Riferimento: '+(compared?'3 mesi presenti.':'incompleto, confronto non disponibile.')+' La presenza dei mesi non certifica la completezza di persone e voci.',511,8.5,muted);
 para(42,723,'FTE medi = somma degli FTE mensili / 3. Organico e ferie: ultimo mese. Differenze di organico non equivalgono al numero di assunzioni o cessazioni. Commenti descrittivi, senza deduzioni causali.',511,8.5,muted);
 para(42,768,'Solo dati dimostrativi. Nessuna connessione al gestionale. Revisionare prima della consegna.',511,8,muted);
 pages.push(commands.join('\n'));
 const objs=['<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];const kids=[];
 pages.forEach(content=>{const streamId=objs.length+1;objs.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);const pageId=objs.length+1;objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`);kids.push(`${pageId} 0 R`);});objs[1]=`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
 let doc='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';const offsets=[0];objs.forEach((o,i)=>{offsets.push(doc.length);doc+=`${i+1} 0 obj\n${o}\nendobj\n`;});const cross=doc.length;doc+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;offsets.slice(1).forEach(n=>doc+=String(n).padStart(10,'0')+' 00000 n \n');doc+=`trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${cross}\n%%EOF\n`;
 return Uint8Array.from(doc,c=>c.charCodeAt(0));
}
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc(data){let c=0xffffffff;for(const b of data)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function zip(files){const enc=new TextEncoder(),chunks=[],central=[];let offset=0,centralSize=0;const join=parts=>{let n=parts.reduce((s,x)=>s+x.length,0),a=new Uint8Array(n),i=0;for(const p of parts){a.set(p,i);i+=p.length;}return a;};
 for(const file of files){const name=enc.encode(file.name),data=typeof file.data==='string'?enc.encode(file.data):file.data,checksum=crc(data);if(file.name.includes('..')||file.name.startsWith('/'))throw Error('Nome archivio non valido.');const h=new Uint8Array(30+name.length),v=new DataView(h.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);v.setUint32(14,checksum,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);h.set(name,30);chunks.push(h,data);
 const c=new Uint8Array(46+name.length),w=new DataView(c.buffer);w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(8,0x800,true);w.setUint16(14,33,true);w.setUint32(16,checksum,true);w.setUint32(20,data.length,true);w.setUint32(24,data.length,true);w.setUint16(28,name.length,true);w.setUint32(42,offset,true);c.set(name,46);central.push(c);centralSize+=c.length;offset+=h.length+data.length;}
 const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);return join([...chunks,...central,end]);
}
function bundle(reports,coverage,options={}){const cols=['azienda','trimestre','costo_trimestre','costo_riferimento','variazione_euro','variazione_percento','fte_medi','persone_fine_periodo','straordinari_ore','assenze_percento','costo_trimestrale_per_fte','variazione_fte_percento','persone_fine_riferimento','ferie_residue_ore'];const rows=reports.map(r=>({azienda:r.company,trimestre:r.quarter,costo_trimestre:r.total,costo_riferimento:r.prior,variazione_euro:r.delta,variazione_percento:r.percent,fte_medi:r.fteAverage,persone_fine_periodo:r.endPeople,straordinari_ore:r.overtime,assenze_percento:r.absencePct,costo_trimestrale_per_fte:r.costPerFte,variazione_fte_percento:r.ftePercent,persone_fine_riferimento:r.priorEndPeople,ferie_residue_ore:r.holidayEnd}));
 const files=reports.map((r,i)=>({name:`report/${String(i+1).padStart(2,'0')}_${C.safeName(r.company)}_${r.quarter}.pdf`,data:pdf(r,options)}));
 files.push({name:'Riepilogo_studio.csv',data:ReportFlow.csv(rows,cols)});
 files.push({name:'Reparti.csv',data:ReportFlow.csv(reports.flatMap(r=>r.departments.map(d=>({azienda:r.company,trimestre:r.quarter,reparto:d.name,costo:d.cost,fte_medi:d.fteAverage}))),['azienda','trimestre','reparto','costo','fte_medi'])});
 files.push({name:'Copertura.csv',data:ReportFlow.csv(coverage.map(c=>({azienda:c.company,mesi_target:c.target.filter(Boolean).length,mesi_riferimento:c.reference.filter(Boolean).length,inclusa:reports.some(r=>r.company===c.company)?'Si':'No'})),['azienda','mesi_target','mesi_riferimento','inclusa'])});
 files.push({name:'LEGGIMI.txt',data:'REPORTFLOW - PACCHETTO DIMOSTRATIVO\nUn PDF per ogni azienda selezionata con tre mesi target presenti.\nRiepilogo_studio.csv contiene gli indicatori aggregati. Copertura.csv documenta le aziende escluse.\nI dati sono fittizi. I commenti sono aritmetici, non valutazioni normative.\nLa presenza dei mesi non garantisce la completezza dei dati. Revisionare prima della consegna.\nNessun dato viene inviato al gestionale o a servizi esterni.\n'});return {files,bytes:zip(files)};
}
return {pdf,zip,bundle};
})();
if(typeof module!=='undefined')module.exports=ReportDocuments;
