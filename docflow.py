"""DocFlow: local PDF classification and copy-only archive generation."""
from __future__ import annotations
import csv, hashlib, io, json, re, sys, unicodedata, uuid, zipfile
from datetime import date, datetime
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent/'vendor'))
from pypdf import PdfReader

DEFAULT_CLIENTS = 'Azienda Alfa | Azienda Alfa SRL; Alfa SRL\nAzienda Beta | Azienda Beta SRL; Beta SRL\nAzienda Gamma | Azienda Gamma SRL; Gamma SRL'
TYPES = ('Fattura', 'Ricevuta')
MAX_FILES, MAX_BYTES, MAX_PAGES = 30, 5*1024*1024, 20

def normalize(value):
    s=unicodedata.normalize('NFKD',str(value))
    return re.sub(r'[^A-Z0-9]+',' ',''.join(c for c in s if not unicodedata.combining(c)).upper()).strip()

def clients_from_text(text):
    if not isinstance(text,str) or len(text)>20000: raise ValueError('Anagrafica non valida.')
    clients=[]; names=set(); aliases_seen={}
    for row in text.splitlines():
        if not row.strip(): continue
        name,_,aliases=row.partition('|');name=name.strip()
        if not name or len(name)>100: raise ValueError('Ogni cliente richiede un nome di massimo 100 caratteri.')
        key=normalize(name)
        if not key or key in names: raise ValueError('Nomi cliente vuoti o duplicati.')
        names.add(key);aliases={key}|{normalize(a) for a in aliases.split(';') if normalize(a)}
        if any(len(a)<3 for a in aliases): raise ValueError('Ogni alias deve contenere almeno 3 caratteri.')
        for a in aliases:
            if a in aliases_seen and aliases_seen[a]!=key: raise ValueError('Alias condiviso tra più clienti: '+a)
            aliases_seen[a]=key
        clients.append({'name':name,'aliases':sorted(aliases)})
    if not clients or len(clients)>50: raise ValueError('Inserisci da 1 a 50 clienti.')
    return clients

def safe_part(value,limit=65):
    value=unicodedata.normalize('NFKD',str(value))
    value=''.join(c for c in value if not unicodedata.combining(c))
    value=re.sub(r'[^a-zA-Z0-9_-]+','_',value).strip('_-')[:limit].rstrip('_-')
    if not value: raise ValueError('Nome privo di caratteri utilizzabili.')
    if re.fullmatch(r'(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])',value,re.I): value='_'+value
    return value

def valid_date(s):
    if not isinstance(s,str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',s): raise ValueError('La data deve essere AAAA-MM-GG.')
    try: d=date.fromisoformat(s)
    except ValueError: raise ValueError('Data inesistente.') from None
    if not 1900<=d.year<=2199: raise ValueError('Data fuori intervallo (1900-2199).')
    return d.isoformat()

def extract_metadata(text,clients):
    normalized=' '+normalize(text)+' '
    matches=[c['name'] for c in clients if any(' '+a+' ' in normalized for a in c['aliases'])]
    client=matches[0] if len(matches)==1 else ''
    headings=[line.strip() for line in text.splitlines()[:20] if line.strip()]
    kinds=set()
    for line in headings:
        if re.match(r'^FATTURA(?:\s+(?:N\.?|NUMERO|ELETTRONICA)\b|\s*$)',line,re.I): kinds.add('Fattura')
        if re.match(r'^RICEVUTA(?:\s+(?:N\.?|NUMERO|DI PAGAMENTO)\b|\s*$)',line,re.I): kinds.add('Ricevuta')
    kind=next(iter(kinds)) if len(kinds)==1 else ''
    dates=[]
    for candidate in re.findall(r'\bData(?:\s+documento|\s+di\s+emissione)?\s*[:\-]\s*(\d{4}-\d{2}-\d{2}|\d{2}/\d{2}/\d{4})',text,re.I):
        if '/' in candidate:
            day,month,year=candidate.split('/');candidate=f'{year}-{month}-{day}'
        try:dates.append(valid_date(candidate))
        except ValueError:dates.append('INVALIDA')
    dates=set(dates);docdate=next(iter(dates)) if len(dates)==1 and 'INVALIDA' not in dates else ''
    numbers=set(re.findall(r'\bNumero\s+documento\s*:\s*([A-Za-z0-9][A-Za-z0-9/_-]{0,49})',text,re.I))
    if not numbers:
        numbers=set(re.findall(r'\b(?:Fattura|Ricevuta)\s+(?:n\.?|numero)\s*[:.]?\s*([A-Za-z0-9][A-Za-z0-9/_-]{0,49})',text,re.I))
    number=next(iter(numbers)) if len(numbers)==1 else ''
    reasons=[]
    if not client:reasons.append('Cliente non riconosciuto' if not matches else 'Più clienti trovati nel testo')
    if not kind:reasons.append('Tipo non riconosciuto o ambiguo')
    if not docdate:reasons.append('Data assente, non valida o ambigua')
    if not number:reasons.append('Numero documento assente o ambiguo')
    return dict(client=client,kind=kind,date=docdate,number=number,reasons=reasons)

def analyze(filename,data,clients):
    name=Path(filename.replace('\\','/')).name[:180] or 'documento.pdf'
    row=dict(id=uuid.uuid4().hex,source=name,sha256=hashlib.sha256(data).hexdigest(),size=len(data),client='',kind='',date='',number='',reasons=[],excerpt='',readable=False,valid_pdf=False)
    if not name.lower().endswith('.pdf'):row['reasons']=['Formato non PDF'];return row
    if len(data)>MAX_BYTES:row['reasons']=['PDF oltre 5 MB'];return row
    try:
        reader=PdfReader(io.BytesIO(data),strict=False)
        if reader.is_encrypted and not reader.decrypt(''):raise ValueError('PDF protetto da password')
        row['valid_pdf']=True
        if len(reader.pages)>MAX_PAGES:row['reasons']=['Oltre 20 pagine: copia esclusa da questa demo'];row['valid_pdf']=False;return row
        text='\n'.join((p.extract_text() or '') for p in reader.pages)
        row['excerpt']=text[:6000]
        if len(text.strip())<25:row['reasons']=['Testo insufficiente: possibile scansione, richiede verifica manuale'];return row
        row['readable']=True;row.update(extract_metadata(text,clients))
    except Exception as e:
        row['reasons']=['PDF non elaborabile: '+str(e)[:180]];row['valid_pdf']=False
    return row

def analyze_batch(files,registry):
    if not 1<=len(files)<=MAX_FILES:raise ValueError('Seleziona da 1 a 30 PDF.')
    clients=clients_from_text(registry);docs=[];seen={}
    for name,data in files:
        row=analyze(name,data,clients)
        if row['sha256'] in seen:
            row['duplicate_of']=seen[row['sha256']];row['reasons'].append('Copia identica a '+row['duplicate_of'])
        else:seen[row['sha256']]=row['source']
        row['ready']=row['valid_pdf'] and not row['reasons'];docs.append((row,data))
    return docs

def destination(row):
    client=str(row.get('client','')).strip();number=str(row.get('number','')).strip();kind=row.get('kind');docdate=valid_date(row.get('date',''))
    if not client or len(client)>100 or not number or len(number)>50:raise ValueError('Cliente e numero sono obbligatori (massimo 100 e 50 caratteri).')
    if kind not in TYPES:raise ValueError('Scegli Fattura o Ricevuta.')
    folder=safe_part(client);filename=f'{kind}_{safe_part(number,45)}_{docdate}.pdf'
    return f'{folder}/{docdate[:7]}/{filename}'

def create_archive(documents,selections):
    if not isinstance(selections,list) or not selections:raise ValueError('Approva almeno un documento.')
    originals={r['id']:(r,data) for r,data in documents};used=set();ids=set();manifest=[];buffer=io.BytesIO()
    with zipfile.ZipFile(buffer,'w',zipfile.ZIP_DEFLATED) as archive:
        for edit in selections:
            if not isinstance(edit,dict):raise ValueError('Selezione non valida.')
            ident=edit.get('id')
            if ident not in originals or ident in ids:raise ValueError('Documento inesistente o ripetuto.')
            ids.add(ident);source,data=originals[ident]
            if not source['valid_pdf']:raise ValueError('Documento non elaborabile: '+source['source'])
            target=destination(edit);path=Path(target);counter=2
            while target.casefold() in used:
                target=str(path.with_name(path.stem+f'__{counter}'+path.suffix)).replace('\\','/');counter+=1
            used.add(target.casefold());archive.writestr(target,data)
            manifest.append({'file_originale':source['source'],'file_archiviato':target,'cliente':edit['client'],'tipo':edit['kind'],'data':edit['date'],'numero':edit['number'],'verifica':'Approvato dall’operatore','avvisi_origine':' | '.join(source['reasons']),'sha256_originale':source['sha256']})
        stream=io.StringIO(newline='');writer=csv.DictWriter(stream,fieldnames=list(manifest[0]),delimiter=';');writer.writeheader()
        for entry in manifest:
            writer.writerow({key:("'"+str(value) if re.match(r'^\s*[=+\-@\t\r]',str(value)) else value) for key,value in entry.items()})
        archive.writestr('REGISTRO_ARCHIVIAZIONE.csv','\ufeff'+stream.getvalue())
        archive.writestr('LEGGIMI.txt','DocFlow - archivio di copie approvate.\nGli originali non vengono spostati o rinominati.\nI suffissi __2, __3 evitano sovrascritture in caso di nomi coincidenti.\nIl registro include dati approvati e avvisi iniziali. Non è una conservazione digitale a norma.\n')
    return buffer.getvalue(),manifest
