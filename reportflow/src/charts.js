/* SVG charts, local and dependency-free. Values stay in the original units. */
const ReportCharts=(()=>{
const palette=['#2c5fb7','#6388bd','#9cb3d2','#b4bfd0'];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function ceiling(values){const max=Math.max(0,...values.filter(Number.isFinite));if(!max)return 1;const p=10**Math.floor(Math.log10(max)),n=max/p;return ([1,1.5,2,2.5,3,4,5,6,8,10].find(v=>v>=n)||10)*p}
const value=(v,cost)=>cost?BatchCore.money(v):BatchCore.number(v)+' h';
function monthly(r,key='cost'){
 const cost=key==='cost',prior=r.priorMonthly,top=ceiling([...r.monthly,...(prior||[])].map(m=>m[key])),x=i=>88+i*242,y=v=>250-v/top*188;
 const tick=v=>cost?(v>=1000?BatchCore.number(v/1000)+'k €':BatchCore.number(v)+' €'):BatchCore.number(v)+' h';
 let svg=`<svg viewBox="0 0 640 332" class="rf-svg" role="group" aria-label="${cost?'Costo mensile in euro':'Ore straordinarie mensili'}: ${esc(r.quarter)}${prior?' e '+esc(r.reference):''}"><title>Confronto mensile; scala da zero</title>`;
 for(let i=0;i<=4;i++){const v=top*i/4;svg+=`<line x1="68" x2="598" y1="${y(v)}" y2="${y(v)}" class="rf-grid"/><text x="56" y="${y(v)+4}" text-anchor="end" class="rf-axis">${tick(v)}</text>`}
 const path=series=>series.map((m,i)=>(i?'L':'M')+x(i)+','+y(m[key])).join(' ');
 if(prior)svg+=`<path d="${path(prior)}" fill="none" stroke="#93a6ba" stroke-width="2.5" stroke-dasharray="6 5"/>`;
 svg+=`<path d="${path(r.monthly)} L${x(2)},250 L${x(0)},250 Z" fill="#2c5fb7" opacity=".065"/><path d="${path(r.monthly)}" fill="none" stroke="#2c5fb7" stroke-width="3" stroke-linejoin="round"/>`;
 r.monthly.forEach((m,i)=>{if(prior)svg+=`<circle cx="${x(i)}" cy="${y(prior[i][key])}" r="4" fill="white" stroke="#93a6ba" stroke-width="2"/>`;svg+=`<g data-month="${i}" role="button" tabindex="0" class="rf-point" aria-label="Dettaglio ${m.month}: ${esc(value(m[key],cost))}"><title>${m.month}: ${esc(value(m[key],cost))}${prior?' | '+prior[i].month+': '+esc(value(prior[i][key],cost)):''}</title><rect x="${x(i)-20}" y="${y(m[key])-20}" width="40" height="40" fill="transparent"/><circle cx="${x(i)}" cy="${y(m[key])}" r="5" fill="white" stroke="#2c5fb7" stroke-width="3"/><rect x="${x(i)-57}" y="${y(m[key])-31}" width="114" height="20" rx="5" fill="white"/><text x="${x(i)}" y="${y(m[key])-17}" text-anchor="middle" class="rf-value">${value(m[key],cost)}</text></g><text x="${x(i)}" y="277" text-anchor="middle" class="rf-axis rf-month">${m.month}</text>${prior?`<text x="${x(i)}" y="295" text-anchor="middle" class="rf-axis">rif. ${prior[i].month}</text>`:''}`});
 svg+='</svg>';
 return `<div class="rf-chart"><div class="rf-chart-head"><div><h3>${cost?'Andamento del costo':'Andamento degli straordinari'}</h3><p>Confronto per posizione del mese nel trimestre · scala da zero</p></div></div><div class="rf-legend"><span><i style="background:#2c5fb7"></i>${esc(r.quarter)}</span>${prior?`<span><i class="rf-dashed"></i>${esc(r.reference)} · riferimento</span>`:'<span>Confronto non disponibile</span>'}</div>${svg}<p class="rf-footnote">Passa sui punti o selezionali per leggere i valori. I mesi di riferimento sono indicati sotto quelli attuali.</p></div>`;
}
function horizontal(items,total,title){const max=ceiling(items.map(d=>d.total));return `<div class="rf-chart"><div class="rf-chart-head"><div><h3>${esc(title)}</h3><p>Importi in euro · ordinati dal maggiore · lunghezze dalla stessa origine zero</p></div></div><div class="rf-hbars">${[...items].sort((a,b)=>b.total-a.total).map((d,i)=>`<div class="rf-hrow"><div class="rf-hlabel"><span>${esc(d.name)}</span><b>${BatchCore.money(d.total)} <small>${total?BatchCore.number(d.total/total*100)+'%':'n.d.'}</small></b></div><div class="rf-track"><div style="width:${d.total/max*100}%;background:${palette[Math.min(i,3)]}"></div></div></div>`).join('')}</div><div class="rf-range"><span>0 €</span><span>${BatchCore.money(max)}</span></div></div>`}
return {ceiling,monthly,horizontal};
})();
if(typeof module!=='undefined')module.exports=ReportCharts;
