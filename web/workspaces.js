'use strict';
let currentModule=null,jobs=[],jobRefs={},lastSnapshots={},saveInFlight=false;
const moduleNames={docs:'Documenti',payroll:'Controlli paghe',reports:'Report',reconcile:'Incassi e fatture'};
function setWorkspaceModule(module){currentModule=module;$('saveWork').classList.toggle('hidden',!module);$('clientArea').classList.add('hidden');showSaveState();updateWorkControls();scheduleAutosave()}
function showSaveState(text){if(!currentModule&&!text){$('workState').textContent='Le lavorazioni possono essere salvate e riprese su questo computer.';return}let ref=jobRefs[currentModule];$('workState').textContent=text||(ref?`${ref.client} · ${ref.period} · salvataggio automatico attivo`:'Autosalvataggio attivo · il lotto sarà recuperabile in Riprendi il tuo lavoro')}
async function snapshotModule(module){
 if(busy||payBusy)throw Error('Attendi il completamento del caricamento.');
 if(module==='docs'){if(!rows.length)throw Error('Carica prima i documenti.');return {version:1,rows,batch,selected}}
 if(module==='payroll'){
  if(!payState)throw Error('Carica prima il CSV paghe.');
  if(payDirty&&$('payStatus')){let a=payState.alerts.find(a=>a.id===paySelected);if(a){let status=$('payStatus').value,note=$('payNote').value;await api('api/payroll/update',{batch:payState.batch,id:a.id,status,note});Object.assign(a,{status,note});payDirty=$('payNote')?.value!==note||$('payStatus')?.value!==status;if($('paySaveHint'))$('paySaveHint').textContent=payDirty?'Aggiornamento in corso…':'Nota acquisita per l’autosalvataggio'}}
  return {version:1,batch:payState.batch,selected:paySelected,search:$('paySearch').value,filter:$('payFilter').value,severity:$('paySeverity').value,payroll:payState};
 }
 const frame=$(module==='reports'?'reportFrame':'reconcileFrame');let bridge=frame.contentWindow?.StudioHubModule;if(!bridge)throw Error('Attendi l’apertura del modulo.');return JSON.parse(JSON.stringify(bridge.snapshot()));
}
async function storeCurrent(metadata,automatic=false){
 if(saveInFlight)throw Error('Un salvataggio è già in corso.');const module=currentModule;if(jobRefs[module]?.status==='completed')return;if(!module)throw Error('Apri prima una lavorazione.');saveInFlight=true;
 try{const snapshot=await snapshotModule(module),raw=JSON.stringify(snapshot);if(automatic&&raw===lastSnapshots[module])return;
  showSaveState('Salvataggio in corso…');const ref=metadata||jobRefs[module]||draftMetadata(module,snapshot);
  const saved=await api('api/jobs/save',{...ref,module,snapshot});jobRefs[module]=saved;jobs=[saved,...jobs.filter(j=>j.id!==saved.id)];renderHomeRecent();lastSnapshots[module]=raw;updateWorkControls();showSaveState(`${saved.client} · ${saved.period} · salvato sul computer alle ${new Date(saved.updated).toLocaleTimeString('it-IT')}`);
 }catch(error){showSaveState('Salvataggio non riuscito: '+error.message);throw error}finally{saveInFlight=false}
}
async function refreshJobs(){
 let r=await fetch('api/jobs');if(!r.ok)throw Error('Elenco non disponibile.');jobs=await r.json();
 function fill(id,values,label){const e=$(id),old=e.value;e.innerHTML=`<option value="">${label}</option>`+[...new Set(values)].sort().map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');e.value=old}
 fill('clientFilter',jobs.map(j=>j.client),'Tutti i clienti');fill('periodFilter',jobs.map(j=>j.period),'Tutti i periodi');$('knownClients').innerHTML=[...new Set(jobs.map(j=>j.client))].map(c=>`<option value="${esc(c)}">`).join('');renderJobs();renderHomeRecent();
}
function renderJobs(){
 let client=$('clientFilter').value,period=$('periodFilter').value,module=$('moduleFilter').value,status=$('statusFilter').value;
 let visible=jobs.filter(j=>(!client||j.client===client)&&(!period||j.period===period)&&(!module||j.module===module)&&(status==='all'||(j.status||'open')===status));
 $('jobsMessage').textContent=visible.length?(visible.length===1?'1 lavorazione salvata':`${visible.length} lavorazioni salvate`):'Nessuna lavorazione per questi filtri. I nuovi lotti vengono salvati automaticamente.';
 $('jobsList').innerHTML=visible.map(j=>`<article class="card"><span class="tag">${esc(moduleNames[j.module])} · ${j.status==='completed'?'Completata':'In corso'}</span><h2 style="margin-top:18px">${esc(j.client)}</h2><h3>${esc(j.title)}</h3><p>${esc(j.period)} · aggiornato ${esc(new Date(j.updated).toLocaleString('it-IT'))}</p><button class="primary" data-resume="${esc(j.id)}">${j.status==='completed'?'Visualizza lavorazione':'Riprendi lavorazione →'}</button><button data-job-status="${esc(j.id)}" style="margin:12px 0 0 8px">${j.status==='completed'?'Riapri':'Segna completata'}</button></article>`).join('');
 $('jobsList').querySelectorAll('[data-resume]').forEach(b=>b.onclick=()=>resumeJob(b.dataset.resume));$('jobsList').querySelectorAll('[data-job-status]').forEach(b=>b.onclick=()=>changeJobStatus(b.dataset.jobStatus));
}
async function openArea(mode='clients'){
 if(saveInFlight){showSaveState('Attendi il salvataggio prima di cambiare area.');return}
 try{if(currentModule&&hasWorkData(currentModule))await storeCurrent(null,true)}catch(e){alert(e.message);return}
 if(payDirty&&!confirm('Ci sono note paghe non salvate. Aprire comunque l’area clienti?'))return;
 for(let id of ['home','docs','payroll','reports','reconcile'])$(id).classList.add('hidden');currentModule=null;$('saveWork').classList.add('hidden');$('finishWork').classList.add('hidden');$('closedWorkHint').classList.add('hidden');$('workState').textContent='Archivio locale delle lavorazioni';$('clientArea').classList.remove('hidden');document.querySelectorAll('aside nav button').forEach(b=>b.classList.toggle('active',b.id===(mode==='resume'?'navResume':'navJobs')));window.scrollTo(0,0);
 $('areaTitle').textContent=mode==='resume'?'Riprendi il tuo lavoro':'Clienti e lavorazioni';$('areaKicker').textContent=mode==='resume'?'IN CORSO E COMPLETATE':'CLIENTI E PERIODI';$('statusFilter').value=mode==='resume'?'open':'all';
 try{await refreshJobs();if(typeof activeCompany!=='undefined'&&activeCompany){$('clientFilter').value=activeCompany.name;$('periodFilter').value='';$('moduleFilter').value='';$('areaTitle').textContent='Lavorazioni · '+activeCompany.name;renderJobs()}}catch(e){$('jobsMessage').textContent=e.message}
}
async function restoreSavedJob(id){
 if(saveInFlight)return;let meta=jobs.find(j=>j.id===id);if(!meta)return;

 try{
 const job=await api('api/jobs/open',{id}),s=job.snapshot;payDirty=false;
 if(job.module==='docs'){rows=s.rows;batch=s.batch;selected=Math.min(s.selected||0,rows.length-1);$('registry').value=s.registry;page(true);stage(2);render()}
 if(job.module==='payroll'){payState=s.payroll;paySelected=s.selected;$('paySearch').value=s.search||'';$('payFilter').value=s.filter||'';$('paySeverity').value=s.severity||'';payPage();payRender()}
 if(job.module==='reports'||job.module==='reconcile'){
  job.module==='reports'?reportPage():reconcilePage();const frame=$(job.module==='reports'?'reportFrame':'reconcileFrame');
  if(!frame.contentWindow?.StudioHubModule)await new Promise((resolve,reject)=>{let attempts=0;const timer=setInterval(()=>{if(frame.contentWindow?.StudioHubModule){clearInterval(timer);resolve()}else if(++attempts>100){clearInterval(timer);reject(Error('Il modulo non si è aperto.'))}},100)});
  frame.contentWindow.StudioHubModule.restore(s);
 }
 jobRefs[job.module]={...job};delete jobRefs[job.module].snapshot;updateWorkControls();lastSnapshots[job.module]=JSON.stringify(await snapshotModule(job.module));showSaveState(job.status==='completed'?'Lavorazione completata · premi Riapri per modificarla':'Lavorazione ripresa · autosalvataggio attivo');
 }catch(e){$('jobsMessage').textContent='Ripresa non completata: '+e.message;alert(e.message)}
}
$('saveWork').onclick=async()=>{
 try{await snapshotModule(currentModule);await refreshJobs();let ref=jobRefs[currentModule];$('saveClient').value=ref?.client||activeCompany?.name||'';$('saveClient').readOnly=!!activeCompany;$('savePeriod').value=ref?.period||(currentModule==='reports'?'2026-Q3':new Date().toISOString().slice(0,7));$('saveTitle').value=ref?.title||moduleNames[currentModule];$('saveAsNew').checked=false;$('copyOption').classList.toggle('hidden',!ref);$('saveError').textContent='';$('saveDialog').showModal()}catch(e){showSaveState(e.message)}
};
$('saveForm').onsubmit=async e=>{e.preventDefault();$('confirmSave').disabled=true;try{let old=$('saveAsNew').checked?{}:jobRefs[currentModule]||{};await storeCurrent({...old,client:$('saveClient').value.trim(),period:$('savePeriod').value.trim(),title:$('saveTitle').value.trim()});$('saveDialog').close()}catch(e){$('saveError').textContent=e.message}finally{$('confirmSave').disabled=false}};
$('cancelSave').onclick=()=>$('saveDialog').close();$('navJobs').onclick=$('openClients').onclick=()=>openArea('clients');$('refreshJobs').onclick=()=>refreshJobs().catch(e=>$('jobsMessage').textContent=e.message);
for(let id of ['clientFilter','periodFilter','moduleFilter','statusFilter'])$(id).onchange=renderJobs;
setInterval(()=>{if(currentModule&&hasWorkData(currentModule)&&!saveInFlight&&!$('saveDialog').open)storeCurrent(null,true).catch(()=>{})},1000);
$('closeApp').onclick=async()=>{try{if(currentModule&&hasWorkData(currentModule))await storeCurrent(null,true);if(!confirm('Chiudere StudioHub? Le lavorazioni salvate resteranno disponibili. Attendi sempre la conferma dell’autosalvataggio prima di spegnere.'))return;await api('api/shutdown',{});document.body.innerHTML='<main style="margin:0;padding:60px"><h1>StudioHub è chiuso.</h1><p>Le lavorazioni salvate restano su questo computer. Riapri StudioHub per riprenderle.</p></main>'}catch(e){showSaveState('Chiusura interrotta: '+e.message)}};
window.addEventListener('beforeunload',e=>{if(currentModule&&hasWorkData(currentModule)){scheduleAutosave();e.preventDefault();e.returnValue=''}});

async function navigateWithSave(fn){
 if(saveInFlight){showSaveState('Attendi il salvataggio prima di cambiare modulo.');return}
 try{if(currentModule&&hasWorkData(currentModule))await storeCurrent(null,true);fn()}catch(e){alert('Prima di cambiare modulo: '+e.message)}
}
$('homeTop').onclick=$('navHome').onclick=()=>navigateWithSave(()=>page(false));
$('start').onclick=$('navDocs').onclick=()=>navigateWithSave(()=>page(true));
$('payStart').onclick=$('navPay').onclick=()=>navigateWithSave(payPage);
$('reportStart').onclick=$('navReport').onclick=()=>navigateWithSave(reportPage);
$('reconcileStart').onclick=$('navReconcile').onclick=()=>navigateWithSave(reconcilePage);

function detachSavedWork(module){delete jobRefs[module];delete lastSnapshots[module];if(currentModule===module){showSaveState();updateWorkControls();scheduleAutosave()}}
window.addEventListener('message',event=>{if(event.origin!==location.origin||event.data?.type!=='studiohub-new-batch')return;for(let [module,id] of [['reports','reportFrame'],['reconcile','reconcileFrame']])if(event.source===$(id).contentWindow)detachSavedWork(module)});

function renderHomeRecent(){
 const host=$('homeRecent');if(!host)return;const open=jobs.filter(j=>j.status!=='completed'&&(typeof activeCompany==='undefined'||!activeCompany||j.client===activeCompany.name));
 host.textContent=open.length?`${open.length} lavorazioni in corso · apri per continuare o completarle`:'Bozze automatiche, lavorazioni in corso e storico delle completate.';
}
$('homeJobs').onclick=$('openResume').onclick=$('navResume').onclick=()=>openArea('resume');
refreshJobs().catch(()=>$('homeRecent').textContent='Apri Clienti e lavorazioni per aggiornare l’elenco.');

function draftMetadata(module,snapshot){
 const now=new Date(),month=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
 return {client:typeof activeCompany!=='undefined'&&activeCompany?activeCompany.name:'Da assegnare',period:module==='reports'&&snapshot.quarter?snapshot.quarter:month,module,title:moduleNames[module]+' · bozza automatica'};
}
function hasWorkData(module){
 if(typeof companyLoading!=='undefined'&&companyLoading)return false;
 if(module==='docs')return rows.length>0&&!busy;
 if(module==='payroll')return !!payState&&!payBusy;
 try{return !!$(module==='reports'?'reportFrame':'reconcileFrame').contentWindow?.StudioHubModule?.snapshot()}catch{return false}
}
function attachLoadedWork(module,ref){
 detachSavedWork(module);if(ref){jobRefs[module]=ref;jobs=[ref,...jobs.filter(j=>j.id!==ref.id)];renderHomeRecent();showSaveState(`${ref.client} · lotto già salvato automaticamente sul computer`);updateWorkControls()}
 scheduleAutosave();
}
let autosaveTimer;
function scheduleAutosave(){
 clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>{if(currentModule&&hasWorkData(currentModule)&&!saveInFlight&&!$('saveDialog').open)storeCurrent(null,true).catch(()=>{})},300);
}
for(let event of ['input','change','click'])document.addEventListener(event,e=>{if(e.target.closest('#saveDialog')||e.target.closest('#clientArea'))return;scheduleAutosave()});
window.addEventListener('message',event=>{if(event.origin!==location.origin)return;if(event.data?.type==='studiohub-work-changed'&&[ $('reportFrame').contentWindow,$('reconcileFrame').contentWindow].includes(event.source))scheduleAutosave()});
function updateWorkControls(){
 const ref=jobRefs[currentModule],closed=ref?.status==='completed';$('finishWork').classList.toggle('hidden',!ref);$('finishWork').textContent=closed?'Riapri lavorazione':'Segna completata';$('saveWork').classList.toggle('hidden',!currentModule||closed);$('closedWorkHint').classList.toggle('hidden',!closed);
 for(let module of ['docs','payroll','reports','reconcile'])$(module).inert=jobRefs[module]?.status==='completed';
}
async function changeJobStatus(id){
 if(saveInFlight)return;let job=jobs.find(j=>j.id===id);if(!job)return;
 try{
  if(jobRefs[currentModule]?.id===id&&job.status!=='completed'){await storeCurrent(null,true);job=jobRefs[currentModule]}
  const updated=await api('api/jobs/status',{id,status:job.status==='completed'?'open':'completed',revision:job.revision});jobs=[updated,...jobs.filter(j=>j.id!==id)];
  for(let module in jobRefs)if(jobRefs[module].id===id)jobRefs[module]=updated;
  renderHomeRecent();renderJobs();updateWorkControls();
  if(currentModule)showSaveState(updated.status==='completed'?'Lavorazione completata · conservata nello storico':'Lavorazione riaperta · autosalvataggio attivo');
 }catch(e){$('jobsMessage').textContent=e.message;showSaveState(e.message)}
}
$('finishWork').onclick=async()=>{if(!currentModule)return;await changeJobStatus(jobRefs[currentModule]?.id)};
