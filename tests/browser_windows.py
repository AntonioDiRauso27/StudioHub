"""Exercise all four modules in Chromium against the packaged Windows runtime."""
import argparse,io,json,os,subprocess,tempfile,time,urllib.request,zipfile
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]

def check(package):
    if os.name!='nt':raise SystemExit('Eseguire questo test su Windows.')
    with tempfile.TemporaryDirectory(prefix='StudioHub browser ') as temp:
        temp=Path(temp);env={**os.environ,'STUDIOHUB_DATA':str(temp/'session')}
        with (temp/'server.log').open('wb') as log:
            process=subprocess.Popen([str(package/'runtime/python.exe'),str(package/'app/server.py'),'--serve'],env=env,stdout=log,stderr=log,creationflags=subprocess.CREATE_NO_WINDOW)
            base=None
            try:
                for _ in range(200):
                    if process.poll() is not None:raise AssertionError((temp/'server.log').read_text())
                    try:
                        base=json.loads((temp/'session/session.json').read_text())['url']
                        with urllib.request.urlopen(base+'health',timeout=1) as r:
                            if json.load(r)['ok']:break
                    except (OSError,ValueError):base=None
                    time.sleep(.1)
                assert base,'Avvio non riuscito'
                with sync_playwright() as p:
                    browser=p.chromium.launch();page=browser.new_page(viewport={'width':1440,'height':1000})
                    page.on('dialog',lambda dialog:dialog.accept())
                    page.goto(base)
                    page.locator('[data-company="alfa"]').wait_for()
                    assert page.locator('[data-company]').count()==3
                    page.locator('#homeUploadXML').click()
                    page.locator('#mixedXMLDemo').click()
                    page.locator('#globalXMLStatus').filter(has_text='salvate').wait_for()
                    assert page.locator('[data-open-invoices]').count()==3
                    page.locator('[data-open-invoices="alfa"]').click()
                    frame=page.frame_locator('#reconcileFrame')
                    frame.locator('#viewLatestInvoices').wait_for()
                    assert frame.locator('#invoiceTable tr').count()>0
                    frame.locator('#viewAllInvoices').click()
                    page.locator('#homeTop').click()
                    page.locator('#homeUploadDocs').click();page.locator('#demo').click()
                    page.locator('#routingResult').filter(has_text='Documenti organizzati').wait_for()
                    assert page.locator('[data-routed]').count()>=3
                    page.locator('#homeTop').click();page.locator('[data-company="alfa"]').click()
                    page.locator('#payStart').click();page.locator('#payNote').fill('Nota verifica Windows aggiornata')
                    page.locator('#paySave').click()
                    with page.expect_download() as event:page.locator('a[href="payroll/export"]').click()
                    assert 'Nota verifica Windows aggiornata' in Path(event.value.path()).read_text(encoding='utf-8-sig')
                    page.locator('#navReport').click();frame=page.frame_locator('#reportFrame')
                    frame.locator('#toCoverage').click();frame.locator('#toTemplate').click();frame.locator('#generate').click()
                    with page.expect_download() as event:frame.locator('#downloadPdf').click()
                    assert Path(event.value.path()).read_bytes().startswith(b'%PDF-')
                    (ROOT/'test-results').mkdir(exist_ok=True)
                    page.screenshot(path=str(ROOT/'test-results/windows-riconcilia.png'),full_page=True)
                    browser.close()
                request=urllib.request.Request(base+'api/shutdown',data=b'{}',headers={'Content-Type':'application/json'})
                urllib.request.urlopen(request).close();process.wait(timeout=10)
                assert process.returncode==0
                print('PASS browser Windows: quattro moduli, note, grafici, CSV, PDF e ZIP scaricati dal pacchetto.')
            finally:
                if process.poll() is None:process.terminate();process.wait(timeout=10)
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--package',type=Path,required=True);args=parser.parse_args();check(args.package.resolve())
