import json,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from workspaces import Workspaces
class SavedWorkTests(unittest.TestCase):
    def test_restart_filters_and_conflicting_edits(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'saved.sqlite3';db=Workspaces(path)
            meta={'client':'Alfa Srl','period':'2026-10','title':'Verifiche ottobre','module':'payroll'}
            initial={'version':1,'note':'Verifica effettuata','value':125.50}
            saved=db.save(meta,initial)
            other=db.save({**meta,'client':'Beta Srl','period':'2026-09'}, {'version':1,'note':'Seconda azienda'})
            restarted=Workspaces(path);self.assertEqual(restarted.get(saved['id'])['snapshot'],initial)
            self.assertEqual({j['client'] for j in restarted.list()},{'Alfa Srl','Beta Srl'})
            newer=restarted.save(saved,{'version':1,'note':'Nota aggiornata'})
            with self.assertRaisesRegex(ValueError,'altra finestra'):restarted.save(saved,{'version':1,'note':'Vecchia nota'})
            self.assertEqual(restarted.get(saved['id'])['snapshot']['note'],'Nota aggiornata')
            self.assertEqual(restarted.get(other['id'])['snapshot']['note'],'Seconda azienda')
            with self.assertRaises(ValueError):restarted.save({**meta,'period':'2026-13'},initial)
            self.assertEqual(len(restarted.list()),2)
    def test_failed_save_preserves_previous_version(self):
        with tempfile.TemporaryDirectory() as folder:
            db=Workspaces(Path(folder)/'saved.sqlite3')
            ref=db.save({'client':'Cliente','period':'2026-Q3','module':'reports','title':'Trimestre'}, {'version':1,'files':[1,2]})
            with self.assertRaises(ValueError):db.save(ref,{'version':1,'value':float('nan')})
            self.assertEqual(db.get(ref['id'])['snapshot']['files'],[1,2])
if __name__=='__main__':unittest.main()

class CompletionAndMigrationTests(unittest.TestCase):
 def test_migrate_existing_database_and_complete_reopen(self):
  import sqlite3,zlib
  with tempfile.TemporaryDirectory() as folder:
   path=Path(folder)/'saved.sqlite3'
   with sqlite3.connect(path) as db:
    db.execute('CREATE TABLE jobs(id TEXT PRIMARY KEY,client TEXT,period TEXT,module TEXT,title TEXT,updated TEXT,revision INTEGER,snapshot BLOB)')
    db.execute('INSERT INTO jobs VALUES(?,?,?,?,?,?,?,?)',('existing','Alfa','2026-10','docs','Documento','2026-10-01',1,zlib.compress(json.dumps({'version':1,'note':'Da conservare'}).encode())))
   store=Workspaces(path);job=store.list()[0];self.assertEqual(job['status'],'open')
   completed=store.set_status(job['id'],'completed',job['revision']);self.assertEqual(completed['status'],'completed')
   with self.assertRaisesRegex(ValueError,'completata'):store.save(completed,{'version':1,'note':'Sovrascrittura indesiderata'})
   reopened=store.set_status(completed['id'],'open',completed['revision']);self.assertEqual(reopened['status'],'open')
   self.assertEqual(store.get('existing')['snapshot']['note'],'Da conservare')
