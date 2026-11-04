import csv,io,json,sys,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT),str(ROOT/'vendor')]
from company_demo import catalog,ensure_companies
from workspaces import Workspaces
class CompanyDemoTests(unittest.TestCase):
 def test_payroll_and_reports_share_people_amounts_and_hours(self):
  for company in catalog(ROOT):
   people={e['id'] for e in company['employees']}
   payroll=list(csv.DictReader(io.StringIO((ROOT/'examples/companies'/company['id']/'paghe.csv').read_text(encoding='utf-8-sig'))))
   self.assertEqual({r['Matricola'] for r in payroll},people)
   pay={(r['Matricola'],r['DataElaborazione'][:7]):r for r in payroll}
   for file in company['reports']['files']:
    for row in csv.DictReader(io.StringIO(file['text']),delimiter=';'):
     original=pay[(row['matricola'],row['mese'])]
     self.assertEqual(row['azienda'],company['name'])
     self.assertEqual(float(row['lordo_corrente'].replace(',','.')),float(original['Lordo_EUR']))
     self.assertEqual(float(row['ore_straordinario'].replace(',','.')),float(original['OreStraordinario']))
 def test_seed_is_separate_idempotent_and_preserves_notes(self):
  with tempfile.TemporaryDirectory() as folder:
   store=Workspaces(Path(folder)/'jobs.db');legacy=store.save({'client':'Da assegnare','period':'2026-10','module':'reports','title':'Lavoro precedente'},{'version':1,'files':[]})
   ensure_companies(ROOT,store);self.assertEqual(len(store.list()),13)
   for company in catalog(ROOT):
    jobs=[j for j in store.list() if j['client']==company['name']];self.assertEqual(len(jobs),4)
    docs=store.get('company-v1-'+company['id']+'-docs')['snapshot']
    self.assertEqual(len(docs['rows']),3)
    self.assertEqual({r['client'] for r in docs['rows']},{company['name']})
    self.assertTrue(all(r['valid_pdf'] and r['date']=='2026-09-0'+str(i+2) for i,r in enumerate(docs['rows'])))
    job=store.get('company-v1-'+company['id']+'-payroll');self.assertGreater(len(job['snapshot']['payroll']['alerts']),0)
    job['snapshot']['payroll']['alerts'][0]['note']='Nota da conservare';store.save(job,job['snapshot'])
   ensure_companies(ROOT,store);self.assertEqual(len(store.list()),13)
   self.assertEqual(store.get('company-v1-alfa-payroll')['snapshot']['payroll']['alerts'][0]['note'],'Nota da conservare')
   self.assertEqual(store.get(legacy['id'])['client'],'Da assegnare')
