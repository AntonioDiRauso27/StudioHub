"use strict";
let inboxMode=false;
let companies=[],activeCompany=null,companyLoading=false,companyExamples={};
const moduleButtons={docs:['start','navDocs'],payroll:['payStart','navPay'],reports:['reportStart','navReport'],reconcile:['reconcileStart','navReconcile']};
async function settleWork(){
 for(let i=0;saveInFlight&&i<100;i++)await new Promise(r=>setTimeout(r,50));
 if(saveInFlight)throw Error('Salvataggio ancora in corso. Riprova tra poco.');
 if(currentModule&&hasWorkData(currentModule))await storeCurrent(null,true);
}
function companyVisibility(){
 $('companyContext').classList.toggle('hidden',!activeCompany);
 for(const ids of Object.values(moduleButtons))$(ids[1]).classList.toggle('hidden',!activeCompany&&!['navDocs','navReconcile'].includes(ids[1]));
 $('navJobs').classList.add('hidden');
 $('openClients').textContent=activeCompany?'Cambia azienda':'Aziende';
 $('companyName').textContent=activeCompany?.name||'';
 $('home').querySelector('.welcome .eyebrow').textContent=activeCompany?.name||'IL TUO SPAZIO';
 $('companyEmployees').innerHTML=activeCompany?'<table><thead><tr><th>Matricola</th><th>Dipendente</th><th>Reparto</th></tr></thead><tbody>'+activeCompany.employees.map(e=>`<tr><td>${esc(e.id)}</td><td>${esc(e.name)}</td><td>${esc(e.department)}</td></tr>`).join('')+'</tbody></table>':'';
 const sample=document.querySelector('a[href^="company-payroll/"],a[href="payroll/template"]');
 if(sample)sample.href=activeCompany?'company-payroll/'+activeCompany.id:'payroll/template';
}
function showPicker(){
 $('invoiceInbox').classList.add('hidden');
 inboxMode=false;
 if(companies.length){document.querySelector('#companyPicker h1').textContent='Il lavoro dello studio';$('companyCards').innerHTML=companies.map(c=>`<button class="company-card" data-company="${c.id}"><span class="company-monogram">${c.name.split(' ')[1][0]}</span><h2>${c.name}</h2><p>${c.employees.length} dipendenti · ${jobs.filter(j=>j.client===c.name&&j.status!=='completed').length} attività aperte</p><span class="company-enter">Apri azienda →</span></button>`).join('');$('companyCards').querySelectorAll('[data-company]').forEach(b=>b.onclick=()=>pickCompany(b.dataset.company));}

 for(const id of ['home','docs','payroll','reports','reconcile','clientArea'])$(id).classList.add('hidden');
 $('companyPicker').classList.remove('hidden');currentModule=null;activeCompany=null;
 $('saveWork').classList.add('hidden');$('finishWork').classList.add('hidden');$('closedWorkHint').classList.add('hidden');
 companyVisibility();$('workState').textContent='Scegli un’azienda per iniziare.';window.scrollTo(0,0);
}
async function pickCompany(code){
 $('invoiceInbox').classList.add('hidden');
 inboxMode=false;$('routingResult').classList.add('hidden');$('routeUnknown').classList.add('hidden');
 if(companyLoading)return;
 try{await settleWork();companyLoading=true;activeCompany=companies.find(c=>c.id===code);if(!activeCompany)throw Error('Azienda non disponibile.');
 $('companyPicker').classList.add('hidden');page(false);companyVisibility();renderHomeRecent();$('workState').textContent=activeCompany.name+' · tutte le attività sono associate a questa azienda';window.scrollTo(0,0);
 }catch(e){alert(e.message)}finally{companyLoading=false}
}
async function resumeJob(id){
 $('invoiceInbox').classList.add('hidden');
 if(companyLoading)return;
 try{await settleWork();companyLoading=true;const meta=jobs.find(j=>j.id===id);if(!meta)throw Error('Lavorazione non disponibile.');
 inboxMode=false;$('routingResult').classList.add('hidden');$('routeUnknown').classList.toggle('hidden',meta.client!=='Da identificare');activeCompany=companies.find(c=>c.name===meta.client)||null;
 $('companyPicker').classList.add('hidden');companyVisibility();
 await restoreSavedJob(id);
 if(activeCompany&&['reports','reconcile'].includes(meta.module)){
  let example=companyExamples[activeCompany.id];if(!example){let response=await fetch('api/company-example/'+activeCompany.id);if(!response.ok)throw Error('Esempi non disponibili.');example=companyExamples[activeCompany.id]=await response.json()}
  $(meta.module==='reports'?'reportFrame':'reconcileFrame').contentWindow.StudioHubModule.setCompanyDemo(example);
 }
 }catch(e){alert(e.message)}finally{companyLoading=false}
}
async function openCompanyModule(module){
 if(!activeCompany){await goCompanies();return}
 try{await settleWork();await refreshJobs();const candidates=jobs.filter(j=>j.client===activeCompany.name&&j.module===module);const latest=candidates.find(j=>j.status!=='completed')||candidates[0];
 if(latest)await resumeJob(latest.id);else throw Error('Nessuna lavorazione disponibile per questa azienda.');
 }catch(e){alert(e.message)}
}
async function goCompanies(){if(companyLoading)return;try{await settleWork();showPicker()}catch(e){alert(e.message)}}
for(const [module,ids] of Object.entries(moduleButtons))for(const id of ids)$(id).onclick=()=>openCompanyModule(module);
$('homeTop').onclick=$('navHome').onclick=$('navJobs').onclick=$('openClients').onclick=goCompanies;
$('companyBack').onclick=()=>activeCompany?pickCompany(activeCompany.id):goCompanies();
for(const id of ['homeJobs','openResume','navResume'])$(id).onclick=showResumeCompanies;
$('oldWork').onclick=async()=>{await openArea('clients');$('companyPicker').classList.add('hidden');$('areaTitle').textContent='Archivio delle lavorazioni precedenti';$('clientFilter').value='';renderJobs()};
// Old work remains available in the archive, but never becomes a company card.
companyVisibility();
fetch('api/companies').then(async response=>{if(!response.ok)throw Error('Preparazione aziende non riuscita.');companies=await response.json();await refreshJobs();$('companyCards').innerHTML=companies.map(c=>`<button class="company-card" data-company="${esc(c.id)}"><span class="company-monogram">${esc(c.name.split(' ')[1][0])}</span><h2>${esc(c.name)}</h2><p>${c.employees.length} dipendenti · ${jobs.filter(j=>j.client===c.name&&j.status!=='completed').length} attività aperte</p><span class="company-enter">Apri azienda →</span></button>`).join('');$('companyCards').querySelectorAll('[data-company]').forEach(b=>b.onclick=()=>pickCompany(b.dataset.company));showPicker()}).catch(e=>$('companyCards').textContent=e.message);

async function showResumeCompanies(){
 try{await settleWork();await refreshJobs();showPicker();document.querySelector('#companyPicker h1').textContent='Riprendi il lavoro di un’azienda';$('companyCards').innerHTML=companies.map(c=>{const pending=jobs.filter(j=>j.client===c.name&&j.status!=='completed');return `<button class="company-card" data-resume-company="${c.id}"><span class="company-monogram">${c.name.split(' ')[1][0]}</span><h2>${c.name}</h2><p>${pending.length} attività da completare</p><span class="company-enter">Vedi attività →</span></button>`}).join('');$('companyCards').querySelectorAll('[data-resume-company]').forEach(b=>b.onclick=async()=>{activeCompany=companies.find(c=>c.id===b.dataset.resumeCompany);$('companyPicker').classList.add('hidden');companyVisibility();await openArea('resume')})}catch(e){alert(e.message)}
}
async function openDocumentInbox(){
 $('invoiceInbox').classList.add('hidden');
 try{await settleWork();inboxMode=true;activeCompany=null;companyVisibility();$('companyPicker').classList.add('hidden');delete jobRefs.docs;delete lastSnapshots.docs;rows=[];page(true);stage(1);$('registry').value=companies.map(c=>c.name).join('\n');$('routingResult').classList.add('hidden');$('routeUnknown').classList.add('hidden');document.querySelector('#docs h1').textContent='Carica i documenti. Li organizziamo per azienda.';$('workState').textContent='Ingresso documenti · Alfa, Beta e Gamma';await refreshJobs();const pending=jobs.filter(j=>j.client==='Da identificare'&&j.status!=='completed');if(pending.length){$('routingResult').classList.remove('hidden');$('routingResult').innerHTML='<h2>Da identificare</h2>'+pending.map(j=>`<p><button data-unknown="${esc(j.id)}">${esc(j.title)} →</button></p>`).join('');$('routingResult').querySelectorAll('[data-unknown]').forEach(b=>b.onclick=()=>resumeJob(b.dataset.unknown));}}catch(e){alert(e.message)}
}
async function showRoutedDocuments(routed){
 rows=[];currentModule=null;$('saveWork').classList.add('hidden');$('finishWork').classList.add('hidden');await refreshJobs();stage(1);$('upload').classList.add('hidden');$('routingResult').classList.remove('hidden');$('routingResult').innerHTML='<h2>Documenti organizzati</h2><p>Apri l’azienda per controllarli. I documenti senza un riferimento univoco richiedono una scelta manuale.</p>'+routed.map(j=>`<p><button data-routed="${esc(j.id)}">${esc(j.client)} · ${j.count} PDF →</button></p>`).join('')+'<button id="inboxAgain">Carica altri documenti</button>';$('routingResult').querySelectorAll('[data-routed]').forEach(b=>b.onclick=()=>resumeJob(b.dataset.routed));$('inboxAgain').onclick=openDocumentInbox;
}
$('routeUnknown').onclick=async()=>{try{await settleWork();let result=await api('api/docs/route',{batch,rows,job:jobRefs.docs?.id});delete jobRefs.docs;delete lastSnapshots.docs;$('routeUnknown').classList.add('hidden');await showRoutedDocuments(result.routed)}catch(e){alert(e.message)}};
$('navDocs').onclick=openDocumentInbox;

window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===$('reconcileFrame').contentWindow&&event.data?.type==='studiohub-invoices-imported'){delete jobRefs.reconcile;delete lastSnapshots.reconcile;currentModule=null;$('workState').textContent='Fatture XML salvate · riapri Incassi dell’azienda per aggiornare il lotto';refreshJobs().then(()=>{if(activeCompany)openCompanyModule('reconcile')})}});

window.prepareInvoiceImport=()=>settleWork();

async function openInvoiceInbox(){
 try{await settleWork();activeCompany=null;inboxMode=false;companyVisibility();for(const id of ['companyPicker','home','docs','payroll','reports','reconcile','clientArea'])$(id).classList.add('hidden');currentModule=null;$('invoiceInbox').classList.remove('hidden');$('saveWork').classList.add('hidden');$('finishWork').classList.add('hidden');$('closedWorkHint').classList.add('hidden');$('workState').textContent='Incassi e fatture · ingresso comune alle tre aziende';window.scrollTo(0,0)}catch(e){alert(e.message)}
}
let globalXMLFiles=[];
async function importGlobalXML(){
 $('mixedXMLDemo').disabled=$('globalXML').disabled=true;$('globalXMLStatus').textContent='Lettura e smistamento delle fatture…';
 try{const result=await api('api/invoices/xml',{files:globalXMLFiles});await refreshJobs();const groups=companies.map(c=>({company:c,rows:result.results.filter(r=>r.company===c.name)}));
 const ordered=result.results.map((row,index)=>({row,index})).sort((a,b)=>(b.row.status==='Da verificare')-(a.row.status==='Da verificare')||(a.row.company||'').localeCompare(b.row.company||'','it'));
 const euro=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(n/100);let lastCompany=null;
 const companySummary='<table class="xml-results-table"><thead><tr><th>Azienda</th><th>Fatture nel caricamento</th><th>Importo complessivo</th></tr></thead><tbody>'+groups.filter(g=>g.rows.length).map(g=>'<tr><td><strong>'+esc(g.company.name)+'</strong></td><td>'+g.rows.length+'</td><td>'+euro(g.rows.reduce((total,r)=>total+(r.invoice?.amount||0),0))+'</td></tr>').join('')+'</tbody></table>';
 $('globalXMLResults').innerHTML='<div class="card" style="margin-top:24px"><h2 class="invoice-main-title">FATTURE</h2>'+companySummary+'<h3 class="invoice-detail-title">Fatture per azienda</h3><div style="overflow:auto"><table class="xml-results-table"><thead><tr><th>Fattura</th><th>Cliente</th><th>Importo</th><th>Azienda</th><th>Esito</th></tr></thead><tbody>'+ordered.map(({row:r,index:i})=>{const company=r.company||'Da identificare';const heading=lastCompany!==company?'<tr style="background:#edf3fc"><th class="invoice-company-title" colspan="5">'+esc(company)+'</th></tr>':'';lastCompany=company;return heading+`<tr><td>${esc(r.invoice?.id||r.name)}${r.invoice?.date?'<small>'+esc(r.invoice.date)+'</small>':''}</td><td>${esc(r.invoice?.client||'—')}</td><td class="xml-money">${r.invoice?new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(r.invoice.amount/100):'—'}</td><td>${esc(r.company||'Da scegliere')}</td><td><strong>${r.status==='Importata'?'✓ Salvata':r.status==='Duplicato ignorato'?'Già presente':'Richiede verifica'}</strong>${r.reason?'<p>'+esc(r.reason)+'</p><label>Assegna azienda<select data-global-company="'+i+'"><option value="">Scegli…</option>'+companies.map(c=>'<option value="'+c.id+'">'+c.name+'</option>').join('')+'</select></label>':''}</td></tr>`}).join('')+'</tbody></table></div>'+(result.results.some(r=>r.status==='Da verificare')?'<button id="retryGlobalXML" style="margin-top:20px">Riprova le fatture da verificare</button>':'')+'<h3 style="margin-top:28px">Continua con gli incassi</h3><p>Scegli l’azienda per vedere le fatture e confrontarle con i movimenti bancari.</p><div class="toolbar">'+groups.filter(g=>g.rows.length).map(g=>`<button data-open-invoices="${g.company.id}">${g.company.name} →</button>`).join('')+'</div></div>';
 $('globalXMLResults').querySelectorAll('[data-open-invoices]').forEach(b=>b.onclick=async()=>{await pickCompany(b.dataset.openInvoices);await openCompanyModule('reconcile')});
 if($('retryGlobalXML'))$('retryGlobalXML').onclick=async()=>{for(const el of document.querySelectorAll('[data-global-company]'))globalXMLFiles[+el.dataset.globalCompany].company=el.value;await importGlobalXML()};
 const added=result.results.filter(r=>r.status==='Importata').length,review=result.results.filter(r=>r.status==='Da verificare').length,existing=result.results.filter(r=>r.status==='Duplicato ignorato').length;$('globalXMLStatus').textContent=added===0&&review===0&&existing>0?'Queste '+existing+' fatture sono già state caricate. Le trovi nelle rispettive aziende. Nessuna copia aggiunta.':[added?added+' nuove fatture salvate automaticamente':'',existing?existing+' fatture già presenti':'',review?review+' fatture richiedono la tua verifica':''].filter(Boolean).join(' · ');$('globalXMLResults').scrollIntoView({behavior:'smooth',block:'start'});
 }catch(e){$('globalXMLStatus').textContent=e.message}finally{$('mixedXMLDemo').disabled=$('globalXML').disabled=false}
}
$('mixedXMLDemo').onclick=async()=>{try{const response=await fetch('api/invoices/examples');if(!response.ok)throw Error('Esempi non disponibili.');globalXMLFiles=await response.json();await importGlobalXML()}catch(e){$('globalXMLStatus').textContent=e.message}};
$('globalXML').onchange=async e=>{try{const files=[...e.target.files];if(!files.length)return;if(files.length>30||files.reduce((n,f)=>n+f.size,0)>20*1024*1024)throw Error('Massimo 30 XML e 20 MB complessivi.');globalXMLFiles=[];for(const file of files){if(file.size>2*1024*1024)throw Error('File oltre 2 MB: '+file.name);const bytes=new Uint8Array(await file.arrayBuffer());let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));globalXMLFiles.push({name:file.name,data:btoa(text)})}await importGlobalXML()}catch(e){$('globalXMLStatus').textContent=e.message}};
$('navReconcile').onclick=openInvoiceInbox;$('navReconcile').title='Incassi e fatture · carica XML misti';$('navReconcile').querySelector('span').textContent='Incassi e fatture';

// One landing page; company work remains accessible from its own activity list.
$('navResume').classList.add('hidden');$('openResume').classList.add('hidden');
$('openClients').textContent='Aziende';
$('homeUploadDocs').onclick=openDocumentInbox;$('homeUploadXML').onclick=openInvoiceInbox;
$('homeJobs').onclick=async()=>{if(!activeCompany){await goCompanies();return}await settleWork();await openArea('resume')};

// In-app navigation history. Save before restoring any previous screen.
const navigationStack=[];
let previousView=null,restoringNavigation=false,navigationTimer;
const navigationSections=['companyPicker','invoiceInbox','home','docs','payroll','reports','reconcile','clientArea'];
function captureView(){
 const section=navigationSections.find(id=>!$(id).classList.contains('hidden'));
 if(!section)return null;
 return {section,company:activeCompany?.id||null,module:currentModule,job:jobRefs[currentModule]?.id||null,inbox:inboxMode,scroll:window.scrollY};
}
function viewKey(view){return view?view.section+'|'+(view.company||''):''}
function updateNavigation(){
 if(restoringNavigation)return;const view=captureView();if(!view)return;
 if(previousView&&viewKey(view)!==viewKey(previousView))navigationStack.push(previousView);
 previousView=view;$('goBack').disabled=!navigationStack.length;
}
new MutationObserver(()=>{clearTimeout(navigationTimer);navigationTimer=setTimeout(updateNavigation,80)}).observe(document.querySelector('main'),{attributes:true,subtree:true,attributeFilter:['class']});
window.addEventListener('scroll',()=>{if(previousView&&!restoringNavigation)previousView.scroll=window.scrollY},{passive:true});
$('goBack').onclick=async()=>{
 if(restoringNavigation||!navigationStack.length)return;$('goBack').disabled=true;
 try{await settleWork();const target=navigationStack[navigationStack.length-1];restoringNavigation=true;
 if(target.job){await refreshJobs();await resumeJob(target.job)}
 else{
  for(const id of navigationSections)$(id).classList.add('hidden');
  activeCompany=companies.find(c=>c.id===target.company)||null;currentModule=null;inboxMode=target.inbox;
  companyVisibility();$(target.section).classList.remove('hidden');$('saveWork').classList.add('hidden');$('finishWork').classList.add('hidden');$('closedWorkHint').classList.add('hidden');
  if(target.section==='home')renderHomeRecent();
  showSaveState(activeCompany?activeCompany.name+' · scegli un’attività':'Scegli un’attività dalla Home.');
 }
 navigationStack.pop();previousView=captureView();window.scrollTo(0,target.scroll||0);
 }catch(e){alert('Impossibile tornare indietro: '+e.message)}finally{restoringNavigation=false;$('goBack').disabled=!navigationStack.length}
};
updateNavigation();
