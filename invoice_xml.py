"""Read ordinary FatturaPA XML invoices; explicit review for unsupported documents."""
import base64,hashlib,xml.etree.ElementTree as ET
from decimal import Decimal,InvalidOperation

def parse_invoice(data,companies,override=None):
 if len(data)>2*1024*1024:raise ValueError('XML oltre 2 MB.')
 if b'<!DOCTYPE' in data.upper() or b'<!ENTITY' in data.upper():raise ValueError('Dichiarazioni XML non consentite.')
 try:root=ET.fromstring(data)
 except ET.ParseError:raise ValueError('XML non leggibile.')
 for node in root.iter():node.tag=node.tag.split('}')[-1]
 if root.tag!='FatturaElettronica':raise ValueError('Serve una fattura elettronica FatturaPA ordinaria.')
 def text(node,path):return (node.findtext(path) or '').strip()
 header=root.find('FatturaElettronicaHeader');bodies=root.findall('FatturaElettronicaBody')
 if header is None or len(bodies)!=1:raise ValueError('Fattura assente o XML con più corpi: verifica manuale richiesta.')
 vat=text(header,'CedentePrestatore/DatiAnagrafici/IdFiscaleIVA/IdCodice');country=text(header,'CedentePrestatore/DatiAnagrafici/IdFiscaleIVA/IdPaese')
 company=next((c for c in companies if c.get('vat')==vat and country=='IT'),None)
 if override:company=next((c for c in companies if c['id']==override),None)
 if not company:raise ValueError('Partita IVA emittente non riconosciuta: scegli l’azienda.')
 body=bodies[0];general=body.find('DatiGenerali/DatiGeneraliDocumento')
 if general is None:raise ValueError('Dati generali mancanti.')
 if text(general,'TipoDocumento') not in ['TD01','TD06']:raise ValueError('Tipo documento non gestito: verifica manuale richiesta (es. nota di credito).')
 if text(general,'Divisa')!='EUR':raise ValueError('Sono gestite soltanto fatture in euro.')
 number=text(general,'Numero');date=text(general,'Data')
 from datetime import date as Date
 try:Date.fromisoformat(date)
 except ValueError:raise ValueError('Data fattura non valida.')
 if not number or len(number)>50:raise ValueError('Numero fattura assente o troppo lungo.')
 try:
  amount=Decimal(text(general,'ImportoTotaleDocumento'));cents=amount*100
  if not amount.is_finite() or cents!=cents.to_integral_value() or cents<=0 or cents>100000000000:raise ValueError()
 except (ValueError,InvalidOperation):raise ValueError('Totale fattura assente o non valido: verifica manuale richiesta.')
 customer=header.find('CessionarioCommittente/DatiAnagrafici');name=text(customer,'Anagrafica/Denominazione') if customer is not None else ''
 if not name and customer is not None:name=(text(customer,'Anagrafica/Nome')+' '+text(customer,'Anagrafica/Cognome')).strip()
 if not name:raise ValueError('Cliente mancante.')
 customerid=text(customer,'IdFiscaleIVA/IdCodice') or text(customer,'CodiceFiscale')
 key='|'.join([country,vat,customerid,date,number]);due=[text(p,'DataScadenzaPagamento') for p in body.findall('DatiPagamento/DettaglioPagamento')]
 return company,{'id':number,'client':name,'date':date,'amount':int(cents),'sourceKey':key,'sourceHash':hashlib.sha256(data).hexdigest(),'dueDates':[d for d in due if d]}

def import_files(store,base,files,companies):
 from datetime import datetime,timezone
 if not isinstance(files,list) or not 1<=len(files)<=30:raise ValueError('Seleziona da 1 a 30 XML.')
 result=[];batch_companies=set()
 for item in files:
  name=str(item.get('name','XML'))[:160]
  try:
   data=base64.b64decode(item.get('data',''),validate=True);company,invoice=parse_invoice(data,companies,item.get('company'))
   candidates=[j for j in store.list() if j['client']==company['name'] and j['module']=='reconcile']
   existing=[store.get(j['id']) for j in candidates]
   same=[i for j in existing for i in j['snapshot'].get('invoices',[]) if i.get('sourceKey')==invoice['sourceKey']]
   if same:
    if any(i.get('sourceHash')!=invoice['sourceHash'] for i in same):raise ValueError('Fattura già presente con contenuto differente: verifica manuale richiesta.')
    result.append({'name':name,'company':company['name'],'status':'Duplicato ignorato','invoice':invoice});continue
   current=next((j for j in existing if j['status']!='completed'),None)
   snapshot=current['snapshot'] if current else {'version':1,'invoices':[],'movements':[],'decisions':{},'selected':None,'chosen':None,'filter':'all','search':''}
   if any(i['id']==invoice['id'] for i in snapshot['invoices']):raise ValueError('Numero fattura già presente nel lotto: verifica manuale richiesta.')
   if company['id'] not in batch_companies:snapshot['lastImportIds']=[];batch_companies.add(company['id'])
   snapshot.setdefault('lastImportIds',[]).append(invoice['id'])
   snapshot['invoices'].append(invoice)
   meta=current or {'client':company['name'],'period':invoice['date'][:7],'module':'reconcile','title':'Fatture XML e incassi'}
   saved=store.save(meta,snapshot);result.append({'name':name,'company':company['name'],'status':'Importata','invoice':invoice,'job':saved['id']})
  except (ValueError,TypeError,KeyError) as error:result.append({'name':name,'status':'Da verificare','reason':str(error)})
 return result


def fresh_examples(base):
    """New invoice identities for every demo run; uploaded files remain unchanged."""
    import secrets
    run=secrets.token_hex(6).upper()
    result=[]
    rng=secrets.SystemRandom()
    counts=rng.sample(range(1,6),3)
    paths=[]
    for code,count in zip(['alfa','beta','gamma'],counts):
        templates=list((base/'examples/companies'/code).glob('*.xml'))
        if not templates:raise ValueError('Esempi XML mancanti.')
        paths.extend(rng.choice(templates) for _ in range(count))
    rng.shuffle(paths)
    for i,path in enumerate(paths,1):
        root=ET.fromstring(path.read_bytes())
        number=next((n for n in root.iter() if n.tag.split('}')[-1]=='Numero'),None)
        if number is None:raise ValueError('Esempio privo del numero fattura.')
        number.text='FT-'+run[:8]+'-'+str(i).zfill(2)
        data=ET.tostring(root,encoding='utf-8',xml_declaration=True)
        result.append({'name':'Fattura_'+path.parent.name.title()+'_'+number.text+'.xml','data':base64.b64encode(data).decode()})
    return result
