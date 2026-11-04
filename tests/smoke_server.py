"""Exercise source server, or the actual Windows portable runtime on Windows."""
import argparse,hashlib,io,json,os,shutil,subprocess,sys,tempfile,time,urllib.error,urllib.request,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def smoke(package=None, engine=None):
    with tempfile.TemporaryDirectory(prefix='DocFlow Test ') as temp:
        temp=Path(temp)
        if package:
            if os.name!='nt':raise SystemExit('Il test del runtime Windows richiede Windows; nessuna esecuzione su macOS.')
            portable=temp/'Portable DocFlow à';shutil.copytree(package,portable)
            exe=portable/'runtime/python.exe';entry=portable/'app/server.py';examples=portable/'app/examples'
        elif engine:exe=engine;entry=None;examples=ROOT/'examples'
        else:exe=Path(sys.executable);entry=ROOT/'server.py';examples=ROOT/'examples'
        runtime=temp/'runtime';env={**os.environ,'STUDIOHUB_DATA':str(runtime),'PYTHONDONTWRITEBYTECODE':'1'}
        options={'stdin':subprocess.DEVNULL}
        if os.name=='nt':options['creationflags']=subprocess.CREATE_NO_WINDOW
        with (temp/'server.log').open('wb') as log:
            child=subprocess.Popen([str(exe),*([str(entry)] if entry else []),'--serve'],env=env,stdout=log,stderr=log,**options)
            base=None
            try:
                for _ in range(400):
                    if child.poll() is not None:raise AssertionError((temp/'server.log').read_text(errors='replace'))
                    try:
                        base=json.loads((runtime/'session.json').read_text())['url']
                        with urllib.request.urlopen(base+'health',timeout=1) as r:
                            if json.load(r)['ok']:break
                    except (OSError,ValueError):base=None
                    time.sleep(.1)
                assert base,'Server non pronto entro 40 secondi'
                with urllib.request.urlopen(base) as r:
                    assert 'Il lavoro dello studio' in r.read().decode('utf-8'), 'Interfaccia non letta come UTF-8'
                with urllib.request.urlopen(base+'theme.css') as r:
                    assert b'Blu notte' in r.read() and 'text/css' in r.headers['Content-Type']
                for route,title in [('reportflow','ReportFlow'),('riconcilia','Riconcilia')]:
                    with urllib.request.urlopen(base+route) as r:assert title in r.read().decode('utf-8')
                def post(route,payload):
                    request=urllib.request.Request(base+'api/'+route,data=json.dumps(payload).encode(),headers={'Content-Type':'application/json'})
                    with urllib.request.urlopen(request,timeout=30) as r:return json.load(r)
                with urllib.request.urlopen(base+'api/config') as r:registry=json.load(r)['registry']
                data=post('demo',{'registry':registry});assert len(data['rows'])==7
                ready=[r for r in data['rows'] if r['ready']];assert len(ready)==3
                manual=next(r for r in data['rows'] if r['source']=='allegato_005.pdf')
                chosen=ready+[{**manual,'client':'Azienda Delta'}]
                result=post('archive',{'batch':data['batch'],'rows':chosen});assert result['count']==4
                with urllib.request.urlopen(base+result['url']) as r:archive=r.read()
                with zipfile.ZipFile(io.BytesIO(archive)) as z:
                    assert z.testzip() is None
                    assert 'REGISTRO_ARCHIVIAZIONE.csv' in z.namelist()
                    for row,target in zip(chosen,result['paths']):
                        assert z.read(target)==(examples/row['source']).read_bytes()
                        assert hashlib.sha256(z.read(target)).hexdigest()==row['sha256']
                duplicate=next(r for r in data['rows'] if r['source']=='copia_004.pdf')
                result=post('archive',{'batch':data['batch'],'rows':[ready[0],duplicate]})
                assert any('__2.pdf' in p for p in result['paths'])
                try:post('archive',{'batch':'stale','rows':chosen});raise AssertionError('Lotto obsoleto accettato')
                except urllib.error.HTTPError as e:assert e.code==400
                payroll=post('payroll/demo',{});assert payroll['total']>0 and payroll['alerts']
                alert=payroll['alerts'][0]
                post('payroll/update',{'batch':payroll['batch'],'id':alert['id'],'status':'Verificato','note':'Riscontro di prova'})
                with urllib.request.urlopen(base+'api/payroll') as r: saved=json.load(r)
                assert saved['alerts'][0]['status']=='Verificato'
                with urllib.request.urlopen(base+'payroll/export') as r: exported=r.read().decode('utf-8-sig')
                assert 'Riscontro di prova' in exported and 'Verificato' in exported
                try:post('payroll/update',{'batch':'stale','id':alert['id'],'status':'Verificato'});raise AssertionError('Lotto paghe obsoleto accettato')
                except urllib.error.HTTPError as e:assert e.code==400
                request=urllib.request.Request(base+'api/payroll/import',data=(examples/'payroll_demo.csv').read_bytes(),headers={'Content-Type':'text/csv'})
                with urllib.request.urlopen(request) as r: imported=json.load(r)
                assert imported['total']==payroll['total'] and imported['batch']!=payroll['batch']
                try:
                    request=urllib.request.Request(base+'api/payroll/import',data=b'invalid\n1',headers={'Content-Type':'text/csv'})
                    urllib.request.urlopen(request);raise AssertionError('CSV non valido accettato')
                except urllib.error.HTTPError as e:assert e.code==400
                with urllib.request.urlopen(base+'api/payroll') as r:assert json.load(r)['batch']==imported['batch']
                print('PASS paghe: demo, caricamento CSV, aggiornamento, esportazione, lotto obsoleto, rifiuto CSV senza perdita dati.')
                exported='movimento;fattura;importo_abbinato\nM1;F-101;500,00\n'
                file=post('download',{'name':'Riconcilia_Abbinamenti.csv','text':exported})
                with urllib.request.urlopen(base+file['url']) as r:
                    assert r.read().decode('utf-8')==exported
                    assert 'attachment' in r.headers['Content-Disposition']
                    assert 'Riconcilia_Abbinamenti.csv' in r.headers['Content-Disposition']
                print('PASS: download CSV HTTP con nome allegato e contenuto identico.')
                buffer=io.BytesIO()
                with zipfile.ZipFile(buffer,'w') as z:z.writestr('esempio.csv','a;b\n1;2\n')
                for name,body,kind in [('ReportFlow_Export_Dimostrativi.zip',buffer.getvalue(),'application/zip'),('Azienda_2026-Q3.pdf',b'%PDF-1.4\nprova','application/pdf')]:
                    request=urllib.request.Request(base+'api/report-download',data=body,headers={'Content-Type':kind,'X-Download-Name':name})
                    with urllib.request.urlopen(request) as r:download=json.load(r)
                    with urllib.request.urlopen(base+download['url']) as r:
                        assert r.read()==body and r.headers['Content-Type']==kind and name in r.headers['Content-Disposition']
                try:
                    request=urllib.request.Request(base+'api/report-download',data=b'invalid',headers={'X-Download-Name':'../invalid.zip'})
                    urllib.request.urlopen(request);raise AssertionError('Nome allegato non valido accettato')
                except urllib.error.HTTPError as e:assert e.code==400
                print('PASS: download ZIP/PDF ReportFlow e rifiuto allegato non valido.')

                post('shutdown',{});child.wait(timeout=10);assert child.returncode==0
                print('PASS: avvio, 7 PDF, classificazione, correzione manuale, ZIP identico agli originali, duplicati, lotto obsoleto, chiusura.')
            finally:
                if child.poll() is None:
                    if base:
                        try:
                            request=urllib.request.Request(base+'api/shutdown',data=b'{}',headers={'Content-Type':'application/json'})
                            urllib.request.urlopen(request,timeout=2).close();child.wait(timeout=5)
                        except Exception:child.terminate();child.wait(timeout=5)
                    else:child.terminate();child.wait(timeout=5)
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--package',type=Path);p.add_argument('--engine',type=Path);args=p.parse_args();smoke(args.package.resolve() if args.package else None,args.engine.resolve() if args.engine else None)
