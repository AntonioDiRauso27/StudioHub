const ReportFlow=(()=>{
 const cents=n=>Math.round((n+Number.EPSILON)*100)/100;
 const fields=['azienda','mese','matricola','reparto','fte','ore_teoriche','ore_assenza','ore_straordinario','ferie_residue','lordo_corrente','contributi_azienda','quota_tfr','ratei_maturati'];
 const labels=['Azienda','Periodo','Matricola','Reparto','FTE','Ore teoriche','Ore di assenza','Ore straordinarie','Ferie residue (ore)','Lordo corrente','Contributi azienda','Quota TFR','Ratei maturati'];
 const headersA=['Ragione sociale','Competenza','Codice dipendente','Centro di costo','FTE contrattuale','Ore previste','Ore assenza','Ore extra','Residuo ferie ore','Retribuzione corrente','Oneri azienda','Accantonamento TFR','Ratei del mese'];
 const headersB=['Company','Period','Employee ID','Department','Contract FTE','Expected hours','Absence hours','Overtime hours','Holiday balance','Current gross','Employer charges','TFR accrual','Monthly accruals'];
 function demo(){const a=[];for(let m=3;m<=8;m++)for(let c=0;c<3;c++)for(let i=1;i<=[24,12,18][c];i++){
  if(c===0&&i===24&&m<7)continue;if(c===2&&i===18&&m===8)continue;
  const f=i%5===0?.5:1,ot=(i%4===0?8+m:2+(i+m)%6)*(m===8&&c===0?1.2:1),base=(1900+i*27+c*110)*f,gross=cents(base+ot*15+(m===6?180:0));
  a.push({azienda:['Officine Emilia','Studio Aurora','Logistica Adriatica'][c],mese:`2026-${String(m).padStart(2,'0')}`,matricola:['OE','SA','LA'][c]+String(i).padStart(3,'0'),reparto:['Produzione','Amministrazione','Commerciale'][i%3],fte:f,ore_teoriche:168*f,ore_assenza:(i+m)%7===0?16:0,ore_straordinario:cents(ot),ferie_residue:48+i*3-m*4,lordo_corrente:gross,contributi_azienda:cents(gross*.3),quota_tfr:cents(gross/13.5),ratei_maturati:cents(base/12)});
 }return a;}
 const sum=(a,key)=>cents(a.reduce((s,r)=>s+(typeof key==='function'?key(r):r[key]),0));
 const cost=r=>cents(r.lordo_corrente+r.contributi_azienda+r.quota_tfr+r.ratei_maturati);
 const prev=m=>{const [y,n]=m.split('-').map(Number);return n===1?`${y-1}-12`:`${y}-${String(n-1).padStart(2,'0')}`;};
 const pick=(a,c,m)=>a.filter(r=>(!c||r.azienda===c)&&r.mese===m);
 function stats(a,c,m){const current=pick(a,c,m),before=pick(a,c,prev(m));let previous=before;
  // A portfolio comparison must cover the same companies in both periods.
  const ids=arr=>[...new Set(arr.map(r=>r.azienda))].sort().join('|');
  const comparable=before.length>0&&ids(before)===ids(current);if(!comparable)previous=[];
  const total=sum(current,cost),prior=sum(previous,cost),fte=sum(current,'fte'),hours=sum(current,'ore_teoriche');
  const old=new Set(previous.map(r=>r.azienda+'|'+r.matricola)),now=new Set(current.map(r=>r.azienda+'|'+r.matricola));
  const yearMonth=String(Number(m.slice(0,4))-1)+m.slice(4),lastYear=pick(a,c,yearMonth),yoyAvailable=lastYear.length>0&&ids(lastYear)===ids(current),yearCost=sum(lastYear,cost);
  return {current,previous,comparable,total,prior,fte,people:current.length,overtime:sum(current,'ore_straordinario'),absence:hours?cents(sum(current,'ore_assenza')/hours*100):null,holiday:sum(current,'ferie_residue'),average:fte?cents(total/fte):null,delta:comparable?cents(total-prior):null,percent:comparable&&prior?cents((total-prior)/prior*100):null,yoy:yoyAvailable&&yearCost?cents((total-yearCost)/yearCost*100):null,entries:comparable?[...now].filter(x=>!old.has(x)).length:null,exits:comparable?[...old].filter(x=>!now.has(x)).length:null};
 }
 function splitCSV(text,separator){text=text.replace(/^\uFEFF/,'');const result=[];let row=[],value='',quoted=false,closed=false;
  for(let i=0;i<text.length;i++){let c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else if(quoted){quoted=false;closed=true;}else if(!value&&!closed)quoted=true;else throw Error('Virgolette non valide nel CSV.');}
   else if(c===separator&&!quoted){row.push(value);value='';closed=false;}
   else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(x=>x.trim()))result.push(row);row=[];value='';closed=false;}
   else {if(closed&&!/\s/.test(c))throw Error('Testo dopo la chiusura delle virgolette.');value+=c;}}
  if(quoted)throw Error('Virgolette non chiuse.');row.push(value);if(row.some(x=>x.trim()))result.push(row);
  if(result.length<2)throw Error('Occorrono intestazione e almeno una riga.');
  const header=result.shift().map(x=>x.trim());if(header.some(h=>!h)||new Set(header).size!==header.length)throw Error('Intestazioni vuote o duplicate.');
  if(result.length>5000)throw Error('Massimo 5.000 righe per importazione.');
  for(let i=0;i<result.length;i++)if(result[i].length!==header.length)throw Error(`Riga ${i+2}: numero di colonne diverso dall’intestazione.`);
  return {header,values:result};
 }
 function number(value,locale){let s=String(value).trim();if(!s)throw Error('cella numerica vuota');
  const pattern=locale==='it'?/^[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?$/:/^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/;
  if(!pattern.test(s))throw Error('numero non valido per il formato selezionato');
  s=locale==='it'?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');let n=Number(s);if(!Number.isFinite(n))throw Error('numero non finito');return cents(n);
 }
 function convert(raw,map,locale,period){
  const chosen=fields.map(f=>map[f]);if(chosen.some(h=>!h||!raw.header.includes(h))||new Set(chosen).size!==fields.length)throw Error('Associa tutti i campi a colonne distinte.');
  const index=Object.fromEntries(fields.map(f=>[f,raw.header.indexOf(map[f])]));const seen=new Set();
  return raw.values.map((v,i)=>{let r={};for(const f of fields){const x=v[index[f]].trim();try{r[f]=fields.indexOf(f)<4?x:number(x,locale);}catch(e){throw Error(`Riga ${i+2}, ${labels[fields.indexOf(f)]}: ${e.message}.`);}}
   if(period==='mmyyyy'){if(!/^(0[1-9]|1[0-2])\/\d{4}$/.test(r.mese))throw Error(`Riga ${i+2}: periodo atteso MM/AAAA.`);r.mese=r.mese.slice(3)+'-'+r.mese.slice(0,2);}
   if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(r.mese)||!r.azienda||!r.matricola||!r.reparto)throw Error(`Riga ${i+2}: campi identificativi o periodo non validi.`);
   if(r.azienda.length>100||r.matricola.length>60||r.reparto.length>100||r.fte<=0||r.fte>1||r.ore_teoriche<=0||r.ore_assenza<0||r.ore_assenza>r.ore_teoriche||r.ore_straordinario<0||fields.slice(9).some(f=>r[f]<0))throw Error(`Riga ${i+2}: importi, FTE o ore fuori dal tracciato dimostrativo.`);
   const key=[r.azienda,r.mese,r.matricola].join('|');if(seen.has(key))throw Error(`Riga ${i+2}: matricola duplicata per azienda e mese.`);seen.add(key);return r;
  });
 }
 function merge(base,incoming,mode){if(mode==='replace')return incoming;const periods=new Set(incoming.map(r=>r.azienda+'|'+r.mese));const out=[...base.filter(r=>!periods.has(r.azienda+'|'+r.mese)),...incoming];if(out.length>5000)throw Error('Lo storico supererebbe 5.000 righe.');return out;}
 const quote=x=>'"'+(typeof x==='string'&&/^[=+@\-\t\r]/.test(x)?"'"+x:String(x??'')).replace(/"/g,'""')+'"';
 const csv=(rows,cols)=>'\uFEFF'+[cols.map(quote).join(';'),...rows.map(r=>cols.map(f=>quote(r[f])).join(';'))].join('\r\n');
 function sample(which){const source=demo().filter(r=>which==='A'?r.mese<'2026-08':r.mese==='2026-08');const heads=which==='A'?headersA:headersB;
  const values=source.map(r=>Object.fromEntries(fields.map((f,i)=>[heads[i],i<4?(f==='mese'&&which==='B'?r.mese.slice(5)+'/'+r.mese.slice(0,4):r[f]):which==='A'?r[f].toFixed(2).replace('.',','):r[f].toFixed(2)])));
  return csv(values,heads);
 }
 function aggregate(a,c,m){const s=stats(a,c,m);return {azienda:c||'Tutte le aziende',mese:m,costo_aziendale:s.total,organico:s.people,fte:s.fte,costo_per_fte:s.average,straordinari_ore:s.overtime,assenze_percento:s.absence,ferie_residue_ore:s.holiday,variazione_euro:s.delta,variazione_percento:s.percent};}
 return {fields,labels,headersA,headersB,demo,sum,cost,prev,pick,stats,splitCSV,number,convert,merge,csv,sample,aggregate,cents};
})();
if(typeof module!=='undefined')module.exports=ReportFlow;
