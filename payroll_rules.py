from collections import defaultdict
import statistics

MONTH_ORDER = {m:i+1 for i,m in enumerate(['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'])}

def pct_delta(value, ref):
    if not ref: return None
    return (value-ref)/ref*100

def alert(rule_id, severity, title, explanation, current=None, reference=None, deviation=None):
    return dict(rule_id=rule_id, severity=severity, title=title, explanation=explanation,
                current_value='' if current is None else str(current),
                reference_value='' if reference is None else str(reference),
                deviation='' if deviation is None else str(deviation))

def analyze(records):
    # Historical medians per employee are more robust than means for payroll exceptions.
    hist = defaultdict(lambda: defaultdict(list))
    for r in records:
        for k in ('lordo','netto','ore_ordinarie','ore_straordinario','imponibile_contributivo','imponibile_fiscale'):
            if r.get(k) is not None:
                hist[r['matricola']][k].append(float(r[k]))
    med = {m:{k:statistics.median(v) for k,v in d.items() if v} for m,d in hist.items()}
    seen = set()
    results = []
    for r in records:
        a=[]; key=(r['matricola'],r['mese'],r['anno']); h=med.get(r['matricola'],{})
        if key in seen:
            a.append(alert('ANA-01','CRITICO','Duplicazione mensile','La stessa matricola compare più volte nello stesso mese.'))
        seen.add(key)
        if not r['matricola'] or not r['dipendente'] or not r['qualifica']:
            a.append(alert('ANA-02','CRITICO','Anagrafica incompleta','Uno o più campi anagrafici obbligatori risultano mancanti.'))
        pt=float(r['perc_part_time'] or 0); theo=float(r['ore_teoriche'] or 0); ordinary=float(r['ore_ordinarie'] or 0)
        overtime=float(r['ore_straordinario'] or 0); absd=float(r['giorni_assenza'] or 0)
        gross=float(r['lordo'] or 0); net=float(r['netto'] or 0); ic=float(r['imponibile_contributivo'] or 0); iff=float(r['imponibile_fiscale'] or 0)
        premio=float(r['premio'] or 0); ind=float(r['indennita'] or 0); una=float(r['una_tantum'] or 0); tred=float(r['tredicesima'] or 0)
        causes=(r['causali_retributive'] or '').upper(); acause=(r['causale_assenza'] or '').strip()
        if (r['part_time']=='No' and pt < 100) or (r['part_time']=='Si' and pt >= 100):
            a.append(alert('CON-01','CRITICO','Part-time incoerente','Indicatore PartTime e percentuale contrattuale non sono coerenti.',pt,'100% se No'))
        if theo>0 and ordinary > theo*1.10:
            dev=pct_delta(ordinary,theo); a.append(alert('ORE-01','VERIFICA','Ore ordinarie elevate','Le ore ordinarie superano di oltre il 10% le ore teoriche del mese.',ordinary,theo,f'{dev:+.1f}%'))
        if absd>=5 and theo>0 and ordinary > theo*0.90:
            a.append(alert('ORE-05','CRITICO','Assenze incoerenti','Sono presenti numerosi giorni di assenza ma le ore ordinarie sono quasi complete.',f'{absd} gg / {ordinary} h',f'{theo} h teoriche'))
        if absd>0 and not acause:
            a.append(alert('ASS-01','VERIFICA','Assenza senza causale','Sono registrati giorni di assenza senza una causale.'))
        if absd==0 and acause:
            a.append(alert('ASS-02','VERIFICA','Causale senza assenza','È presente una causale di assenza ma i giorni di assenza sono zero.'))
        if h.get('ore_straordinario',0)>=1 and overtime > max(30,h['ore_straordinario']*2.5):
            dev=pct_delta(overtime,h['ore_straordinario']); a.append(alert('ORE-04','CRITICO','Straordinari eccezionali','Le ore di straordinario sono molto superiori allo storico personale.',overtime,h['ore_straordinario'],f'{dev:+.1f}%'))
        if h.get('lordo'):
            dev=pct_delta(gross,h['lordo'])
            # Variable items act as an available justification, not as proof of correctness.
            variable = premio+ind+una+tred
            if dev is not None and dev>50 and variable < gross*0.15 and overtime < max(15,h.get('ore_straordinario',0)*2):
                a.append(alert('ECO-02','CRITICO','Lordo fortemente anomalo','Il lordo supera di oltre il 50% lo storico personale senza elementi variabili sufficienti nei dati disponibili.',f'€ {gross:.2f}',f'€ {h["lordo"]:.2f}',f'{dev:+.1f}%'))
            elif dev is not None and dev>20 and variable < gross*0.10:
                a.append(alert('ECO-01','VERIFICA','Lordo elevato','Il lordo supera di oltre il 20% lo storico personale e richiede verifica.',f'€ {gross:.2f}',f'€ {h["lordo"]:.2f}',f'{dev:+.1f}%'))
            if dev is not None and dev<-30 and absd<3:
                a.append(alert('ECO-03','VERIFICA','Lordo ridotto','Il lordo è inferiore di oltre il 30% allo storico senza assenze sufficienti a spiegarlo.',f'€ {gross:.2f}',f'€ {h["lordo"]:.2f}',f'{dev:+.1f}%'))
        if h.get('netto'):
            dev=pct_delta(net,h['netto'])
            if dev is not None and dev>50 and (premio+ind+una+tred)<net*0.15:
                a.append(alert('NET-01','CRITICO','Netto anomalo','Il netto supera di oltre il 50% lo storico personale senza elementi variabili sufficienti.',f'€ {net:.2f}',f'€ {h["netto"]:.2f}',f'{dev:+.1f}%'))
        if gross>0 and net>gross:
            a.append(alert('NET-02','CRITICO','Netto superiore al lordo','Il netto risulta superiore alla retribuzione lorda.',f'€ {net:.2f}',f'€ {gross:.2f}'))
        if gross>0 and (net/gross > .92 or net/gross < .45):
            a.append(alert('NET-03','VERIFICA','Rapporto netto/lordo anomalo','Il rapporto tra netto e lordo è fuori dall’intervallo operativo di controllo.',f'{net/gross*100:.1f}%','45%–92%'))
        if gross>0 and (ic/gross < .70 or ic/gross > 1.15):
            a.append(alert('IMP-01','VERIFICA','Imponibile contributivo incoerente','Il rapporto imponibile contributivo/lordo è anomalo.',f'{ic/gross*100:.1f}%','70%–115%'))
        if gross>0 and (iff/gross < .60 or iff/gross > 1.15):
            a.append(alert('IMP-02','VERIFICA','Imponibile fiscale incoerente','Il rapporto imponibile fiscale/lordo è anomalo.',f'{iff/gross*100:.1f}%','60%–115%'))
        if premio>=700 and 'PREMIO' not in causes:
            a.append(alert('VAR-01','VERIFICA','Premio senza causale','È presente un premio elevato ma manca una causale retributiva coerente.',f'€ {premio:.2f}'))
        if ind>=500 and 'IND_' not in causes:
            a.append(alert('VAR-02','VERIFICA','Indennità senza causale','È presente un’indennità elevata ma manca una causale retributiva coerente.',f'€ {ind:.2f}'))
        if una>=500 and 'UNA_TANTUM' not in causes:
            a.append(alert('VAR-03','VERIFICA','Una tantum senza causale','È presente una una tantum elevata ma manca la causale corrispondente.',f'€ {una:.2f}'))
        if tred>0 and r['mese']!='Dicembre':
            a.append(alert('VAR-04','VERIFICA','Tredicesima fuori periodo','È valorizzata la tredicesima in un mese diverso da dicembre.',f'€ {tred:.2f}',r['mese']))
        results.append((r,a))
    return results
