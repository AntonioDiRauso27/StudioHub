"""Consistent, fictitious company fixtures. Never modifies existing work."""
import json,base64,zlib
from datetime import datetime,timezone
from docflow import analyze_batch
import payroll

def catalog(base):
    return json.loads((base/'examples/companies/companies.json').read_text(encoding='utf-8'))

def ensure_companies(base,store):
    companies=catalog(base)
    with store.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        for company in companies:
            code=company['id'];folder=base/'examples/companies'/code
            for module in ['docs','payroll','reports','reconcile']:
                ident='company-v1-'+code+'-'+module
                if db.execute('SELECT 1 FROM jobs WHERE id=?',(ident,)).fetchone():continue
                if module=='docs':
                    docs=analyze_batch([(p.name,p.read_bytes()) for p in sorted(folder.glob('*.pdf'))],company['name'])
                    snapshot={'version':1,'rows':[{**row,'approved':False} for row,_ in docs],'documents':[[row,base64.b64encode(data).decode()] for row,data in docs],'registry':company['name'],'batch':ident,'selected':0}
                elif module=='payroll':
                    data=payroll.load_csv((folder/'paghe.csv').read_bytes())
                    snapshot={'version':1,'payroll':data,'batch':data['batch']}
                else:snapshot=company[module]
                title={'docs':'Documenti settembre','payroll':'Controlli paghe aprile–settembre','reports':'Report terzo trimestre','reconcile':'Incassi settembre'}[module]
                period='2026-Q3' if module in ['reports','payroll'] else '2026-09'
                db.execute('INSERT INTO jobs(id,client,period,module,title,updated,revision,snapshot,status) VALUES(?,?,?,?,?,?,?,?,?)',(ident,company['name'],period,module,title,datetime.now(timezone.utc).isoformat(),1,zlib.compress(json.dumps(snapshot,ensure_ascii=False).encode()),'open'))
    return companies
