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
                    def save_job(title,module):
                        page.locator('#saveWork').click();page.locator('#saveClient').fill('Lotto test Windows');page.locator('#savePeriod').fill('2026-Q3' if module=='reports' else '2026-10');page.locator('#saveTitle').fill(title);page.locator('#confirmSave').click();page.locator('#saveDialog').wait_for(state='hidden')
                    page.goto(base);page.locator('#start').click();page.locator('#demo').click();page.locator('#approve').click();page.locator('#export').click()
                    with page.expect_download() as event:page.locator('#download').click()
                    with zipfile.ZipFile(event.value.path()) as z:assert z.testzip() is None and 'REGISTRO_ARCHIVIAZIONE.csv' in z.namelist()
                    save_job('Documenti Windows','docs')
                    page.locator('#homeTop').click();page.locator('#payStart').click();page.locator('#payDemo').click();page.locator('#payNote').fill('Nota test Windows');page.locator('#payStatus').select_option('Verificato');page.locator('#paySave').click();page.get_by_text('Verifica aggiornata.',exact=False).wait_for()
                    with page.expect_download() as event:page.locator('a[href="payroll/export"]').click()
                    assert 'Nota test Windows' in Path(event.value.path()).read_text(encoding='utf-8-sig')
                    save_job('Paghe Windows','payroll')
                    page.locator('#homeTop').click();page.locator('#reportStart').click();frame=page.frame_locator('#reportFrame')
                    with page.expect_download() as event:frame.locator('#downloadSamples').click()
                    with zipfile.ZipFile(event.value.path()) as z:assert len(z.namelist())==6 and z.testzip() is None
                    frame.locator('#loadDemo').click();frame.locator('#toCoverage').click();frame.locator('#toTemplate').click();frame.locator('#generate').click()
                    frame.locator('[data-month]').first.click();frame.locator('#chartDetail').filter(has_text='2026-07').wait_for()
                    with page.expect_download() as event:frame.locator('#downloadPdf').click()
                    assert Path(event.value.path()).read_bytes().startswith(b'%PDF-')
                    with page.expect_download() as event:frame.locator('#downloadZip').click()
                    with zipfile.ZipFile(event.value.path()) as z:assert len([n for n in z.namelist() if n.endswith('.pdf')])==3 and z.testzip() is None
                    save_job('Report Windows','reports')
                    page.locator('#homeTop').click();page.locator('#reconcileStart').click();frame=page.frame_locator('#reconcileFrame');frame.locator('#demo').click();frame.locator('#confirm').click()
                    with page.expect_download() as event:frame.locator('[data-export="links"]').click()
                    content=Path(event.value.path()).read_text(encoding='utf-8-sig');assert 'M1' in content and 'F-101' in content
                    page.locator('#homeTop').click();page.locator('#reconcileStart').click();frame.locator('#detail').filter(has_text='M1 / Confermato').wait_for()
                    save_job('Incassi Windows','reconcile')
                    page.locator('#openClients').click();page.locator('#jobsList .card').filter(has_text='Incassi Windows').get_by_role('button').click();frame.locator('#detail').filter(has_text='M1 / Confermato').wait_for()
                    (ROOT/'test-results').mkdir(exist_ok=True);page.screenshot(path=str(ROOT/'test-results/windows-riconcilia.png'),full_page=True)
                    browser.close()
                request=urllib.request.Request(base+'api/shutdown',data=b'{}',headers={'Content-Type':'application/json'})
                urllib.request.urlopen(request).close();process.wait(timeout=10)
                assert process.returncode==0
                print('PASS browser Windows: quattro moduli, note, grafici, CSV, PDF e ZIP scaricati dal pacchetto.')
            finally:
                if process.poll() is None:process.terminate();process.wait(timeout=10)
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--package',type=Path,required=True);args=parser.parse_args();check(args.package.resolve())
