import io,json,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import server
class LauncherVersionTests(unittest.TestCase):
 def test_old_session_is_not_reused(self):
  with tempfile.TemporaryDirectory() as d:
   directory=Path(d);lock=directory/'session.json';lock.write_text(json.dumps({'url':'http://127.0.0.1:12345/old/'}))
   def request(url,**kwargs):
    return io.BytesIO(json.dumps({'ok':True,**({'version':server.APP_VERSION} if '/new/' in url else {})}).encode())
   def spawn(command,log):lock.write_text(json.dumps({'url':'http://127.0.0.1:12346/new/'}))
   with patch.object(server,'data_dir',return_value=directory),patch.object(server.urllib.request,'urlopen',side_effect=request),patch.object(server,'spawn_server',side_effect=spawn) as launch,patch.object(server.webbrowser,'open') as browser:
    server.launch();launch.assert_called_once();browser.assert_called_once_with('http://127.0.0.1:12346/new/')
 def test_matching_session_is_reused(self):
  with tempfile.TemporaryDirectory() as d:
   directory=Path(d);address='http://127.0.0.1:12345/current/';(directory/'session.json').write_text(json.dumps({'url':address}))
   with patch.object(server,'data_dir',return_value=directory),patch.object(server.urllib.request,'urlopen',side_effect=lambda *a,**k:io.BytesIO(json.dumps({'ok':True,'version':server.APP_VERSION}).encode())),patch.object(server,'spawn_server') as launch,patch.object(server.webbrowser,'open') as browser:
    server.launch();launch.assert_not_called();browser.assert_called_once_with(address)
if __name__=='__main__':unittest.main()
