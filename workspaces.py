"""Local, transactional storage of resumable work. No browser-local data store."""
import json,re,secrets,sqlite3,zlib
from datetime import datetime,timezone
MODULES={'docs','payroll','reports','reconcile'}
class Workspaces:
    def __init__(self,path):
        self.path=path
        with self.connect() as db:
            db.execute('''CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY, client TEXT NOT NULL, period TEXT NOT NULL,
                module TEXT NOT NULL, title TEXT NOT NULL, updated TEXT NOT NULL,
                revision INTEGER NOT NULL, snapshot BLOB NOT NULL)''')
            columns={r['name'] for r in db.execute('PRAGMA table_info(jobs)')}
            if 'status' not in columns:db.execute("ALTER TABLE jobs ADD COLUMN status TEXT NOT NULL DEFAULT 'open'")
        try:path.chmod(0o600)
        except OSError:pass
    def connect(self):
        db=sqlite3.connect(self.path);db.row_factory=sqlite3.Row;db.execute('PRAGMA synchronous=FULL');return db
    def list(self):
        with self.connect() as db:
            return [dict(r) for r in db.execute('SELECT id,client,period,module,title,updated,revision,status FROM jobs ORDER BY updated DESC,id')]
    def get(self,ident):
        with self.connect() as db:row=db.execute('SELECT * FROM jobs WHERE id=?',(ident,)).fetchone()
        if row is None:raise ValueError('Lavorazione non trovata.')
        result=dict(row);result['snapshot']=json.loads(zlib.decompress(result['snapshot']));return result
    def save(self,payload,snapshot):
        if not isinstance(payload,dict):raise ValueError('Lavorazione non valida.')
        def label(key,limit):
            v=payload.get(key)
            if not isinstance(v,str) or not v.strip() or len(v)>limit or any(ord(c)<32 for c in v):raise ValueError('Completa cliente e titolo con valori validi.')
            return v.strip()
        client=label('client',100);title=label('title',160);period=payload.get('period','');module=payload.get('module')
        if module not in MODULES:raise ValueError('Modulo non valido.')
        if not isinstance(period,str) or not re.fullmatch(r'20\d{2}-(?:0[1-9]|1[0-2]|Q[1-4])',period):raise ValueError('Periodo: usa AAAA-MM oppure AAAA-Q1, Q2, Q3 o Q4.')
        if not isinstance(snapshot,dict) or snapshot.get('version')!=1:raise ValueError('Formato del salvataggio non valido.')
        raw=json.dumps(snapshot,ensure_ascii=False,allow_nan=False).encode()
        if len(raw)>65*1024*1024:raise ValueError('Lavorazione oltre 65 MB.')
        ident=payload.get('id');now=datetime.now(timezone.utc).isoformat(timespec='microseconds')
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            if ident:
                row=db.execute('SELECT module,revision,status FROM jobs WHERE id=?',(ident,)).fetchone()
                if row is None or row['module']!=module:raise ValueError('Lavorazione inesistente o modulo non coerente.')
                if row['status']=='completed':raise ValueError('Lavorazione completata: riaprila prima di modificarla.')
                if payload.get('revision')!=row['revision']:raise ValueError('Lavorazione aggiornata da un’altra finestra. Riaprila dall’area clienti per evitare sovrascritture.')
                revision=row['revision']+1
                db.execute('UPDATE jobs SET client=?,period=?,title=?,updated=?,revision=?,snapshot=? WHERE id=?',(client,period,title,now,revision,zlib.compress(raw),ident))
            else:
                ident=secrets.token_hex(16);revision=1
                db.execute('INSERT INTO jobs(id,client,period,module,title,updated,revision,snapshot) VALUES(?,?,?,?,?,?,?,?)',(ident,client,period,module,title,now,revision,zlib.compress(raw)))
        return dict(id=ident,client=client,period=period,module=module,title=title,updated=now,revision=revision,status='open')

    def set_status(self,ident,status,revision):
        if status not in {'open','completed'}:raise ValueError('Stato non valido.')
        now=datetime.now(timezone.utc).isoformat(timespec='microseconds')
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row=db.execute('SELECT revision FROM jobs WHERE id=?',(ident,)).fetchone()
            if row is None:raise ValueError('Lavorazione non trovata.')
            if revision!=row['revision']:raise ValueError('Lavorazione aggiornata da un’altra finestra. Aggiorna l’elenco.')
            db.execute('UPDATE jobs SET status=?,revision=revision+1,updated=? WHERE id=?',(status,now,ident))
            result=dict(db.execute('SELECT id,client,period,module,title,updated,revision,status FROM jobs WHERE id=?',(ident,)).fetchone())
        return result
