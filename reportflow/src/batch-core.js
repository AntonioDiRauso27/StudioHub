const BatchCore=(()=>{
const M=ReportFlow,round=M.cents;
function quarters(q){const [year,n]=q.split('-Q').map(Number);return [0,1,2].map(i=>`${year}-${String((n-1)*3+1+i).padStart(2,'0')}`);}
function quarter(m){return m.slice(0,4)+'-Q'+Math.ceil(Number(m.slice(5))/3);}
function previous(q){const [y,n]=q.split('-Q').map(Number);return n===1?`${y-1}-Q4`:`${y}-Q${n-1}`;}
function demo(){return M.demo().map(r=>({...r,mese:`2026-${String(Number(r.mese.slice(5))+1).padStart(2,'0')}`}));}
function demoFiles(){return [...new Set(demo().map(r=>r.mese))].sort().map((month,i)=>{
 const format=i%2?'B':'A',heads=format==='A'?M.headersA:M.headersB,rows=demo().filter(r=>r.mese===month);
 const converted=rows.map(r=>Object.fromEntries(M.fields.map((f,j)=>[heads[j],j<4?(f==='mese'&&format==='B'?month.slice(5)+'/'+month.slice(0,4):r[f]):format==='A'?r[f].toFixed(2).replace('.',','):r[f].toFixed(2)])));
 return {name:`Export_${format}_${month}.csv`,text:M.csv(converted,heads),format};});}
function auto(text,profiles={}){
 let raw,separator;for(const sep of [';',',','\t']){try{const candidate=M.splitCSV(text,sep);if(candidate.header.length>=M.fields.length){raw=candidate;separator=sep;break;}}catch{}}
 if(!raw)throw Error('Separatore o intestazioni non riconosciuti. Usa un CSV con almeno 13 colonne.');
 const signature=JSON.stringify(raw.header);const saved=Object.prototype.hasOwnProperty.call(profiles,signature)?profiles[signature]:null;
 const map=saved?.map||Object.fromEntries(M.fields.map((f,i)=>[f,[f,M.headersA[i],M.headersB[i]].find(h=>raw.header.includes(h))||'']));
 const b=raw.header.includes('Period');return {raw,separator,map,locale:saved?.locale||(b?'en':'it'),period:saved?.period||(b?'mmyyyy':'iso'),signature};
}
function validateFiles(files){const rows=[],seen=new Map();for(const file of files){if(file.error)throw Error(`Correggi ${file.name}: ${file.error}`);for(const r of file.rows||[]){const key=JSON.stringify([r.azienda,r.mese,r.matricola]);if(seen.has(key))throw Error(`Record ripetuto per ${r.azienda}, ${r.mese}, ${r.matricola} nei file ${seen.get(key)} e ${file.name}. Rimuovi uno dei file o correggi i dati.`);seen.set(key,file.name);rows.push(r);}}if(!rows.length)throw Error('Carica almeno un export valido.');if(rows.length>15000)throw Error('Massimo 15.000 record nel lotto.');return rows;}
function coverage(rows,q){const months=quarters(q),before=quarters(previous(q));return [...new Set(rows.map(r=>r.azienda))].sort().map(company=>{const present=new Set(rows.filter(r=>r.azienda===company).map(r=>r.mese));return {company,target:months.map(m=>present.has(m)),reference:before.map(m=>present.has(m)),complete:months.every(m=>present.has(m)),comparable:before.every(m=>present.has(m)),months,referenceMonths:before};});}
function summarize(rows,company,q){const months=quarters(q),a=rows.filter(r=>r.azienda===company&&months.includes(r.mese));const pm=quarters(previous(q)),b=rows.filter(r=>r.azienda===company&&pm.includes(r.mese));const cov=coverage(rows,q).find(c=>c.company===company);if(!cov?.complete)throw Error('Trimestre incompleto per '+company);
 const total=M.sum(a,M.cost),prior=cov.comparable?M.sum(b,M.cost):null;const monthly=months.map(month=>{const r=a.filter(x=>x.mese===month);return {month,cost:M.sum(r,M.cost),people:r.length,fte:M.sum(r,'fte'),overtime:M.sum(r,'ore_straordinario'),absence:M.sum(r,'ore_assenza'),hours:M.sum(r,'ore_teoriche')};});
 const departments=[...new Set(a.map(r=>r.reparto))].sort().map(name=>{const r=a.filter(x=>x.reparto===name);return {name,cost:M.sum(r,M.cost),fteAverage:round(M.sum(r,'fte')/3),overtime:M.sum(r,'ore_straordinario'),absence:M.sum(r,'ore_assenza'),hours:M.sum(r,'ore_teoriche'),holidayEnd:M.sum(r.filter(x=>x.mese===months[2]),'ferie_residue')};});
 const components=[['Lordo corrente','lordo_corrente'],['Contributi azienda','contributi_azienda'],['Quota TFR','quota_tfr'],['Ratei maturati','ratei_maturati']].map(([name,key])=>({name,total:M.sum(a,key),change:prior===null?null:round(M.sum(a,key)-M.sum(b,key))}));
 const fteMean=M.sum(a,'fte')/3, priorFte=prior===null?null:M.sum(b,'fte')/3;
 const priorMonthly=pm.map(month=>{const r=b.filter(x=>x.mese===month);return {month,cost:M.sum(r,M.cost),people:r.length,fte:M.sum(r,'fte'),overtime:M.sum(r,'ore_straordinario'),absence:M.sum(r,'ore_assenza'),hours:M.sum(r,'ore_teoriche')};});
 return {priorMonthly:prior===null?null:priorMonthly,priorFteAverage:priorFte===null?null:round(priorFte),ftePercent:priorFte?round((fteMean-priorFte)/priorFte*100):null,costPerFte:fteMean?round(total/fteMean):null,priorCostPerFte:priorFte?round(prior/priorFte):null,priorEndPeople:prior===null?null:priorMonthly[2].people,priorOvertime:prior===null?null:M.sum(b,'ore_straordinario'),priorAbsencePct:prior===null?null:round(M.sum(b,'ore_assenza')/M.sum(b,'ore_teoriche')*100),company,quarter:q,reference:previous(q),total,prior,delta:prior===null?null:round(total-prior),percent:prior?round((total-prior)/prior*100):null,fteAverage:round(M.sum(a,'fte')/3),endPeople:monthly[2].people,averagePeople:round(monthly.reduce((s,x)=>s+x.people,0)/3),overtime:M.sum(a,'ore_straordinario'),absencePct:M.sum(a,'ore_teoriche')?round(M.sum(a,'ore_assenza')/M.sum(a,'ore_teoriche')*100):null,holidayEnd:M.sum(a.filter(r=>r.mese===months[2]),'ferie_residue'),monthly,departments,components};
}
function reports(rows,q,companies){return companies.map(c=>summarize(rows,c,q));}
const money=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n),number=n=>new Intl.NumberFormat('it-IT',{maximumFractionDigits:1}).format(n);
function comments(r){const a=[];if(r.prior===null)a.push('Il confronto con il trimestre precedente non è disponibile: mancano uno o più export di riferimento.');else{a.push(`Il costo del trimestre è ${money(r.total)}, con una variazione di ${r.delta>=0?'+':''}${money(r.delta)} (${r.percent===null?'percentuale non disponibile: riferimento a zero':(r.percent>=0?'+':'')+number(r.percent)+'%'}) rispetto al trimestre precedente.`);const component=[...r.components].sort((a,b)=>Math.abs(b.change)-Math.abs(a.change))[0];if(component.change)a.push(`La componente con la variazione assoluta maggiore è ${component.name.toLowerCase()}: ${component.change>0?'+':''}${money(component.change)}.`);}
 a.push(`Gli FTE medi sono ${number(r.fteAverage)} e le persone presenti nell'ultimo mese sono ${r.endPeople}. Le ore straordinarie nel trimestre sono ${number(r.overtime)}.`);a.push(`Le assenze rappresentano il ${number(r.absencePct)}% delle ore teoriche. I residui ferie dell'ultimo mese ammontano a ${number(r.holidayEnd)} ore.`);return a;}
function safeName(s){return s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]/g,'_').replace(/_+/g,'_').slice(0,70)||'Azienda';}
return {quarters,quarter,previous,demo,demoFiles,auto,validateFiles,coverage,summarize,reports,money,number,comments,safeName};
})();
if(typeof module!=='undefined')module.exports=BatchCore;
