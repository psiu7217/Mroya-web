"""Failure/scope regression tests; no Docker or live release is started."""
import importlib.machinery,importlib.util,json,pathlib,tempfile,unittest
from unittest.mock import patch
FILE=pathlib.Path(__file__).with_name('mroya-web-deploy')
loader=importlib.machinery.SourceFileLoader('webdeploy',str(FILE));spec=importlib.util.spec_from_loader(loader.name,loader);helper=importlib.util.module_from_spec(spec);loader.exec_module(helper)
REAL_BUILD_SOURCE=helper.build_source
class DeployTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);root=pathlib.Path(self.tmp.name)
  self.config=root/'config';self.state=root/'state';self.config.mkdir();self.state.mkdir()
  (self.config/'compose.yaml').write_text('previous compose artifact')
  self.commands=[];self.fail_build=False;self.fail_candidate_http=False;self.swapped=False
  def run(args,timeout=120):
   self.commands.append(args)
   if 'build' in args and self.fail_build:raise RuntimeError('build failed')
   if args[:len(helper.D)]==helper.D and args[len(helper.D):len(helper.D)+2]==['image','tag']:
    if args[-1]==helper.IMAGE:self.swapped='release-' in args[-2]
   if 'wget' in args and self.swapped and self.fail_candidate_http:raise RuntimeError('HTTP failed')
   return b''
  def build_source(dest):return 'approved-main-commit'
  for name,value in [('CONFIG',self.config),('STATE',self.state),('run',run),('current_image',lambda:'old-web-image'),('build_source',build_source)]:
   patcher=patch.object(helper,name,value);patcher.start();self.addCleanup(patcher.stop)
  patcher=patch.object(helper.time,'sleep',lambda _:None);patcher.start();self.addCleanup(patcher.stop)
  patcher=patch.object(helper.signal,'signal',lambda *_:None);patcher.start();self.addCleanup(patcher.stop)
 def assert_scope(self):
  for command in self.commands:
   self.assertNotIn('down',command);self.assertNotIn('prune',command);self.assertNotIn('ps',command);self.assertNotIn('inspect',command)
   if command[:len(helper.C)]==helper.C:
    args=command[len(helper.C):];self.assertIn('web',args)
    if args[0]=='up':self.assertEqual(args,['up','-d','--no-deps','--pull','never','web'])
 def test_success_retains_image_and_compose_and_http_only(self):
  helper.deploy();record=helper.read_record('last-success.json');self.assertEqual(record['current']['revision'],'approved-main-commit');self.assertIn('rollback-',record['previous']['image']);self.assertEqual(pathlib.Path(record['previous']['compose']).read_text(),'previous compose artifact');self.assertFalse((self.state/'pending.json').exists());self.assert_scope()
 def test_build_failure_never_switches_live_image(self):
  self.fail_build=True
  with self.assertRaisesRegex(RuntimeError,'build failed'):helper.deploy()
  self.assertFalse(any(command[-1]==helper.IMAGE for command in self.commands));self.assertFalse((self.state/'pending.json').exists());self.assert_scope()
 def test_failed_http_restores_previous_image_and_compose(self):
  self.fail_candidate_http=True
  with self.assertRaisesRegex(RuntimeError,'HTTP check failed'):helper.deploy()
  self.assertFalse(self.swapped);self.assertEqual((self.config/'compose.yaml').read_text(),'previous compose artifact');self.assertFalse((self.state/'pending.json').exists());self.assert_scope()
 def test_manual_rollback_updates_record_and_retains_current(self):
  helper.deploy();before=helper.read_record('last-success.json');helper.rollback();after=helper.read_record('last-success.json');self.assertEqual(after['current'],before['previous']);self.assertEqual(after['previous'],before['current']);self.assert_scope()
 def test_interrupted_update_recovers_retained_artifacts(self):
  artifact=self.state/'old-compose.yaml';artifact.write_text('old configuration');previous={'image':'mroya-web:retained','compose':str(artifact),'revision':'old'};before={'current':previous,'previous':None}
  helper.write_record('pending.json',{'previous':previous,'before':before});(self.config/'compose.yaml').write_text('wrong configuration');helper.recover_pending();self.assertEqual((self.config/'compose.yaml').read_text(),'old configuration');self.assertEqual(helper.read_record('last-success.json'),before);self.assert_scope()
 def test_build_source_uses_exact_git_commit_not_dirty_checkout(self):
  import io,tarfile
  stream=io.BytesIO()
  with tarfile.open(fileobj=stream,mode='w') as tar:
   entry=tarfile.TarInfo('index.html');content=b'approved source';entry.size=len(content);tar.addfile(entry,io.BytesIO(content))
  for name in ['Dockerfile','nginx.conf']:(self.config/name).write_text('trusted '+name)
  calls=[]
  def git(*args):calls.append(args);return b'commit-sha\n' if args[0]=='rev-parse' else stream.getvalue() if args[0]=='archive' else b''
  with patch.object(helper,'git',git),patch.object(helper,'build_source',REAL_BUILD_SOURCE):self.assertEqual(helper.build_source(self.state),'commit-sha')
  self.assertEqual((self.state/'index.html').read_text(),'approved source');self.assertEqual(calls[-1],('archive','--format=tar','commit-sha'));self.assertFalse(any('reset' in c or 'merge' in c or 'status' in c for c in calls))
if __name__=='__main__':unittest.main()
