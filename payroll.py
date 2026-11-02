"""Session-based payroll review; rules reused from Payroll Control."""
import csv, io, math, secrets
from payroll_rules import analyze, MONTH_ORDER
MAP = {'Mese': 'mese', 'Anno': 'anno', 'Matricola': 'matricola', 'Dipendente': 'dipendente', 'Qualifica': 'qualifica', 'Livello': 'livello', 'TipoRapporto': 'tipo_rapporto', 'PartTime': 'part_time', 'PercPartTime': 'perc_part_time', 'OreTeoriche': 'ore_teoriche', 'OreOrdinarie': 'ore_ordinarie', 'OreStraordinario': 'ore_straordinario', 'GiorniAssenza': 'giorni_assenza', 'CausaleAssenza': 'causale_assenza', 'Lordo_EUR': 'lordo', 'ImponibileContributivo_EUR': 'imponibile_contributivo', 'ImponibileFiscale_EUR': 'imponibile_fiscale', 'Netto_EUR': 'netto', 'PremioProduzione_EUR': 'premio', 'Indennita_EUR': 'indennita', 'UnaTantum_EUR': 'una_tantum', 'Tredicesima_EUR': 'tredicesima', 'CausaliRetributive': 'causali_retributive', 'DataElaborazione': 'data_elaborazione'}
NUMBERS = {'perc_part_time','ore_teoriche','ore_ordinarie','ore_straordinario','giorni_assenza','lordo','netto','imponibile_contributivo','imponibile_fiscale','premio','indennita','una_tantum','tredicesima'}
STATUSES = ('Da verificare','Verificato','Da approfondire')
def load_csv(data):
    if len(data)>5*1024*1024: raise ValueError('CSV oltre 5 MB.')
    try: text=data.decode('utf-8-sig')
    except UnicodeDecodeError: raise ValueError('Usa un CSV con codifica UTF-8.')
    reader=csv.DictReader(io.StringIO(text))
    if not reader.fieldnames or len(set(reader.fieldnames))!=len(reader.fieldnames): raise ValueError('Intestazioni assenti o duplicate.')
    missing=set(MAP)-set(reader.fieldnames)
    if missing: raise ValueError('Colonne mancanti: '+', '.join(sorted(missing)))
    records=[]
    for line,row in enumerate(reader,2):
        if len(records)>=10000: raise ValueError('Massimo 10.000 righe per questa demo.')
        if None in row or any(v is None for v in row.values()): raise ValueError(f'Riga {line}: numero di colonne non valido.')
        r={v:row[k].strip() for k,v in MAP.items()}
        for key in NUMBERS:
            try:
                value=float(r[key]);assert math.isfinite(value) and value>=0
            except (ValueError,AssertionError): raise ValueError(f'Riga {line}: valore non valido in {key}. Usa il punto per i decimali.')
            r[key]=value
        if r['mese'] not in MONTH_ORDER: raise ValueError(f'Riga {line}: mese non valido, usa il nome italiano.')
        try: year=int(r['anno']);assert 1900<=year<=2199
        except (ValueError,AssertionError): raise ValueError(f'Riga {line}: anno non valido.')
        r['anno']=year
        if r['part_time'] not in ('Si','No'): raise ValueError(f'Riga {line}: PartTime deve essere Si oppure No.')
        r['source_row']=line;records.append(r)
    if not records: raise ValueError('Il CSV non contiene dati.')
    alerts=[]
    for r,items in analyze(records):
        for a in items:
            alerts.append({**a,'id':secrets.token_hex(12),'dipendente':r['dipendente'],'matricola':r['matricola'],'mese':r['mese'],'anno':r['anno'],'source_row':r['source_row'],'status':'Da verificare','note':''})
    return {'batch':secrets.token_hex(12),'total':len(records),'alerts':alerts,'flagged_records':len(set(a['source_row'] for a in alerts))}
def update(state,payload):
    if not state or payload.get('batch')!=state['batch']: raise ValueError('Importazione cambiata: ricarica i casi.')
    status=payload.get('status');note=payload.get('note','')
    if status not in STATUSES or not isinstance(note,str) or len(note)>3000: raise ValueError('Stato o nota non validi.')
    alert=next((a for a in state['alerts'] if a['id']==payload.get('id')),None)
    if alert is None: raise ValueError('Caso inesistente.')
    alert.update(status=status,note=note)
def export_csv(state):
    if not state: raise ValueError('Importa prima un CSV.')
    keys=['severity','matricola','dipendente','mese','anno','source_row','rule_id','title','explanation','current_value','reference_value','deviation','status','note']
    stream=io.StringIO(newline='');writer=csv.writer(stream,delimiter=';');writer.writerow(keys)
    for a in state['alerts']:
        writer.writerow([("'"+str(a[k]) if str(a[k]).lstrip().startswith(('=','+','-','@')) else a[k]) for k in keys])
    return ('\ufeff'+stream.getvalue()).encode('utf-8')
