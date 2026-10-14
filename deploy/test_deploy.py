"""Run the Bash helper with fake Git/sudo/Docker/Compose; no network or runtime."""
import importlib.util, json, os, pathlib, subprocess, tempfile, unittest
from unittest.mock import patch
DEPLOY = pathlib.Path(__file__).parent
FAKE = r"""#!/usr/bin/python3
import io,json,os,pathlib,shutil,sys,tarfile
name=pathlib.Path(sys.argv[0]).name; args=sys.argv[1:]
with open(os.environ['CALLS'],'a') as f:f.write(json.dumps([name,*args])+'\n')
mode=os.environ.get('MODE',''); checkout=pathlib.Path(os.environ['CHECKOUT'])
if name=='sudo':
 assert args[:3]==['-u','psiu','-H']
 os.execvp(args[3],args[3:])
elif name=='stat':
 print('other' if mode=='foreign' else 'psiu')
elif name=='git':
 assert args[:4]==['-c','credential.helper=','-c','credential.helper=store --file=/home/psiu/.config/mroya/git-credentials']
 args=args[4:]
 if args[:1]==['-C']:args=args[2:]
 op=args[0]
 if op=='clone':
  assert args==['clone','--branch','main','https://github.com/psiu7217/Mroya-web.git',str(checkout)]
  shutil.copytree(os.environ['SEED'],checkout)
 elif op=='remote':print('https://example.invalid/foreign.git' if mode=='remote' else 'https://github.com/psiu7217/Mroya-web.git')
 elif op=='branch':print('feature' if mode=='branch' else 'main')
 elif op=='status':print(' M package.json' if mode=='dirty' else '')
 elif op=='pull':
  assert args==['pull','--ff-only','origin','main']
  if mode=='conflict':sys.exit(1)
 elif op=='rev-parse':print(('b' if mode=='ahead' and args[1]=='FETCH_HEAD' else 'a')*40)
 elif op=='cat-file':sys.exit(0 if (checkout/args[2].split(':')[1]).exists() else 1)
 elif op=='archive':
  assert args[1]=='a'*40
  with tarfile.open(fileobj=sys.stdout.buffer,mode='w|') as archive:
   for item in args[3:]:archive.add(checkout/item,arcname=item)
 else:raise AssertionError(args)
elif name=='docker':
 if args[0]=='build':
  context=pathlib.Path(args[-1])
  pkg=json.loads((context/'package.json').read_text()); lock=json.loads((context/'package-lock.json').read_text())
  assert (context/'nginx.conf').read_text()=='existing runtime nginx'
  assert not (context/'.env').exists()
  for key in ['dependencies','devDependencies','optionalDependencies']:
   if pkg.get(key,{})!=lock['packages'][''].get(key,{}):sys.exit(2)
  if mode=='build':sys.exit(2)
 elif args[:2]!=['image','tag']:raise AssertionError(args)
elif name=='compose':
 if 'exec' in args and mode=='http':sys.exit(7)
elif name=='sleep':pass
else:raise AssertionError(name)
"""
class DeployTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=pathlib.Path(self.tmp.name)
  self.checkout=self.root/'checkout';self.config=self.root/'config';self.state=self.root/'state';self.bin=self.root/'bin'
  for p in [self.checkout,self.config,self.state,self.bin,self.root/'tmp',self.checkout/'.git',self.checkout/'src',self.checkout/'scripts',self.checkout/'deploy']:p.mkdir()
  (self.checkout/'package.json').write_text(json.dumps({'dependencies':{'react':'^19'}}))
  (self.checkout/'package-lock.json').write_text(json.dumps({'packages':{'':{'dependencies':{'react':'^19'}}}}))
  (self.checkout/'deploy/npm-lock.fallback.json').write_bytes((self.checkout/'package-lock.json').read_bytes())
  for name in ['index.html','tsconfig.json','vite.config.ts']:(self.checkout/name).write_text('approved main')
  (self.checkout/'scripts/check-production.mjs').write_text('bundle check')
  (self.checkout/'.env').write_text('not part of build context')
  for name in ['compose.yaml','empty.env']:(self.config/name).write_text('existing configuration')
  (self.config/'nginx.conf').write_text('existing runtime nginx')
  (self.config/'Dockerfile').write_bytes((DEPLOY/'Dockerfile').read_bytes())
  for name in ['sudo','stat','git','docker','compose','sleep']:
   p=self.bin/name;p.write_text(FAKE);p.chmod(0o755)
  self.log=self.root/'calls.jsonl'
  script=(DEPLOY/'mroya-web-deploy').read_text().replace('$EUID == 0 && ','')
  for old,new in [('/home/psiu/mroya-web-deployment',self.checkout),('/etc/mroya-web-deploy',self.config),('/var/lib/mroya-web-deploy',self.state),('/usr/bin/docker',self.bin/'docker'),('/usr/libexec/docker/cli-plugins/docker-compose',self.bin/'compose'),('/tmp/mroya-web-build.XXXXXX',self.root/'tmp/build.XXXXXX')]:script=script.replace(old,str(new))
  self.helper=self.root/'helper';self.helper.write_text(script)
 def run_helper(self,mode=''):
  env=os.environ|{'SEED':str(self.root/'seed'),'PATH':str(self.bin)+':'+os.environ['PATH'],'CALLS':str(self.log),'CHECKOUT':str(self.checkout),'MODE':mode}
  result=subprocess.run(['bash',str(self.helper)],env=env,capture_output=True,text=True)
  self.calls=[json.loads(line) for line in self.log.read_text().splitlines()] if self.log.exists() else []
  self.assertEqual(list((self.root/'tmp').iterdir()),[])
  for call in self.calls:
   self.assertFalse(set(call)&{'down','prune','rmi','rollback','inspect'})
   if call[0]=='compose':
    self.assertEqual(call[-1],'web' if 'up' in call else 'http://127.0.0.1:8080/')
    self.assertIn('mroya-web',call)
  return result
 def test_success_https_psiu_exact_main_runtime_nginx_and_web_only(self):
  r=self.run_helper();self.assertEqual(r.returncode,0,r.stderr);self.assertIn('SUCCESS: mroya-web '+'a'*40,r.stdout)
  self.assertTrue(any(c[0]=='sudo' and c[1:4]==['-u','psiu','-H'] for c in self.calls))
  up=[c for c in self.calls if c[0]=='compose' and 'up' in c]
  self.assertEqual(up[0][-7:],['up','-d','--no-deps','--no-build','--pull','never','web'])
  self.assertTrue(any('wget' in c for c in self.calls))
  self.assertEqual([p.name for p in self.state.iterdir()],['deployment.lock'])
 def test_missing_checkout_is_cloned_from_https_main_as_psiu(self):
  self.checkout.rename(self.root/'seed')
  r=self.run_helper();self.assertEqual(r.returncode,0,r.stderr)
  self.assertTrue(any('clone' in c and 'main' in c and 'https://github.com/psiu7217/Mroya-web.git' in c for c in self.calls))
 def test_invalid_checkout_never_builds_or_publishes(self):
  for mode in ['foreign','remote','branch','dirty','conflict','ahead']:
   with self.subTest(mode=mode):
    self.log.unlink(missing_ok=True);r=self.run_helper(mode);self.assertNotEqual(r.returncode,0)
    self.assertFalse(any(c[0] in ['docker','compose'] for c in self.calls))
 def test_studio_removed_primary_lock_uses_reviewed_fallback(self):
  (self.checkout/'package-lock.json').unlink()
  r=self.run_helper();self.assertEqual(r.returncode,0,r.stderr)
  self.assertIn('using reviewed deploy/npm-lock.fallback.json',r.stderr)
  self.assertTrue(any(c[0]=='docker' and 'build' in c for c in self.calls))
  self.assertTrue(any(c[0]=='compose' and 'up' in c for c in self.calls))
 def test_missing_both_locks_never_builds_or_publishes(self):
  (self.checkout/'package-lock.json').unlink()
  (self.checkout/'deploy/npm-lock.fallback.json').unlink()
  r=self.run_helper();self.assertNotEqual(r.returncode,0)
  self.assertIn('both package-lock.json and deploy/npm-lock.fallback.json are absent',r.stderr)
  self.assertFalse(any(c[0] in ['docker','compose'] for c in self.calls))
 def test_stale_fallback_cannot_publish_incompatible_dependencies(self):
  (self.checkout/'package-lock.json').unlink()
  (self.checkout/'package.json').write_text(json.dumps({'dependencies':{'react':'^20'}}))
  r=self.run_helper();self.assertNotEqual(r.returncode,0)
  self.assertFalse(any(c[0]=='compose' or c[1:3]==['image','tag'] for c in self.calls))
 def test_existing_primary_lock_is_preferred_over_stale_fallback(self):
  (self.checkout/'deploy/npm-lock.fallback.json').write_text(json.dumps({'packages':{'':{'dependencies':{'react':'^20'}}}}))
  r=self.run_helper();self.assertEqual(r.returncode,0,r.stderr)
  self.assertNotIn('using reviewed deploy/npm-lock.fallback.json',r.stderr)
 def test_inconsistent_lock_and_build_error_never_publish(self):
  for mode in ['lock','build']:
   with self.subTest(mode=mode):
    if mode=='lock':(self.checkout/'package.json').write_text(json.dumps({'dependencies':{'react':'^20'}}))
    if mode=='build':(self.checkout/'package.json').write_text(json.dumps({'dependencies':{'react':'^19'}}))
    self.log.unlink(missing_ok=True);r=self.run_helper(mode);self.assertNotEqual(r.returncode,0)
    self.assertFalse(any(c[0]=='compose' or c[1:3]==['image','tag'] for c in self.calls))
 def test_post_start_failure_is_explicit_without_rollback(self):
  r=self.run_helper('http');self.assertNotEqual(r.returncode,0);self.assertIn('local Nginx HTTP smoke',r.stderr)
  self.assertIn('No automatic rollback',r.stderr)
  self.assertEqual(sum(c[0]=='compose' and 'up' in c for c in self.calls),1)
  self.assertEqual(sum(c[0]=='docker' and c[1:3]==['image','tag'] for c in self.calls),1)
  self.assertEqual(sum('wget' in c for c in self.calls),30)
 def test_dockerfile_checks_locked_dependencies_and_production_in_build_stage(self):
  s=(DEPLOY/'Dockerfile').read_text()
  for required in ['npm ci --ignore-scripts --no-audit --no-fund','npm run lint','MROYA_BUILD_TARGET=production npm run build:production','node scripts/check-production.mjs','lock.packages','deepEqual']:self.assertIn(required,s)
  self.assertNotIn('npm install',s)
class InstallerTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=pathlib.Path(self.tmp.name)
  self.config=self.root/'config';self.config.mkdir()
  self.helper=self.root/'helper';self.helper.write_text('old helper');self.helper.chmod(0o750)
  self.dockerfile=self.config/'Dockerfile';self.dockerfile.write_text('old Dockerfile');self.dockerfile.chmod(0o640)
  (self.config/'compose.yaml').write_text('unchanged compose');(self.config/'nginx.conf').write_text('unchanged nginx')
  self.checkout=self.root/'checkout';self.checkout.mkdir();(self.checkout/'.git').mkdir()
  spec=importlib.util.spec_from_file_location('installer',DEPLOY/'install.py')
  self.m=importlib.util.module_from_spec(spec);spec.loader.exec_module(self.m)
  source=(DEPLOY/'install.py').read_text().replace("pathlib.Path('/usr/local/sbin/mroya-web-deploy')","pathlib.Path("+repr(str(self.helper))+")")
  exec(compile(source,str(DEPLOY/'install.py'),'exec'),self.m.__dict__)
  self.raw_git=self.m.git;self.remote_sha='approved-sha';self.git_calls=[]
  def git(*args):
   self.git_calls.append(args)
   if args[0]=='remote':return self.m.REMOTE.encode()
   if args[0]=='branch':return b'main'
   if args[0]=='status':return b''
   if args[0]=='rev-parse':return b'approved-sha'
   if args[0]=='ls-remote':
    self.assertEqual(args,('ls-remote','--exit-code',self.m.REMOTE,'refs/heads/main'))
    return (self.remote_sha+'\trefs/heads/main\n').encode()
   self.assertEqual(args[0],'show')
   return b'new Dockerfile' if args[-1].endswith('Dockerfile') else (DEPLOY/'mroya-web-deploy').read_bytes()
  for name,value in [('CHECKOUT',self.checkout),('CONFIG',self.config),('git',git)]:
   patcher=patch.object(self.m,name,value);patcher.start();self.addCleanup(patcher.stop)
  patcher=patch.object(pathlib.Path,'owner',lambda p:'psiu' if p in [self.checkout,self.checkout/'.git'] else 'root')
  patcher.start();self.addCleanup(patcher.stop)
  patcher=patch.object(self.m.os,'chown');self.chown=patcher.start();self.addCleanup(patcher.stop)
  patcher=patch.object(self.m.subprocess,'run',return_value=subprocess.CompletedProcess([],0));self.run=patcher.start();self.addCleanup(patcher.stop)
  self.real_replace=os.replace
  patcher=patch.object(self.m.os,'replace',wraps=self.real_replace);self.replace=patcher.start();self.addCleanup(patcher.stop)
  self.before=self.snapshot()
 def snapshot(self):
  return {p:(p.read_bytes(),p.stat().st_mode&0o777) for p in self.root.rglob('*') if p.is_file()}
 def assert_clean(self):
  self.assertFalse(list(self.root.rglob('.mroya-web-update-*')))
  self.assertFalse(any(c[0] in ['pull','reset','clean','checkout'] for c in self.git_calls))
 def test_current_remote_main_allows_only_two_expected_replacements(self):
  self.m.update();after=self.snapshot()
  changed={p for p in after if after[p]!=self.before[p]}
  self.assertEqual(changed,{self.helper,self.dockerfile});self.assertEqual(set(after),set(self.before))
  self.assertEqual(self.dockerfile.read_bytes(),b'new Dockerfile')
  self.assertEqual(self.helper.read_bytes(),(DEPLOY/'mroya-web-deploy').read_bytes())
  self.assertEqual(after[self.helper][1],0o755);self.assertEqual(after[self.dockerfile][1],0o644)
  self.assertEqual([c.args[1] for c in self.replace.call_args_list],[self.dockerfile,self.helper])
  self.assertEqual(sum(c.args[1:]==(0,0) for c in self.chown.call_args_list),2)
  self.assert_clean()
 def test_stale_head_stops_before_staging_or_changing_files(self):
  self.remote_sha='new-main-sha'
  with self.assertRaisesRegex(RuntimeError,'synchronize and review'):self.m.update()
  self.replace.assert_not_called();self.chown.assert_not_called();self.run.assert_not_called()
  self.assertEqual(self.snapshot(),self.before);self.assert_clean()
 def test_syntax_failure_preserves_installed_pair(self):
  self.run.side_effect=subprocess.CalledProcessError(2,['bash','-n'])
  with self.assertRaises(subprocess.CalledProcessError):self.m.update()
  self.replace.assert_not_called();self.assertEqual(self.snapshot(),self.before);self.assert_clean()
 def test_second_replace_error_restores_first_bytes_and_permissions(self):
  count=0
  def replace(source,target):
   nonlocal count
   count+=1
   if count==2:raise OSError('simulated second replacement failure')
   return self.real_replace(source,target)
  self.replace.side_effect=replace
  with self.assertRaisesRegex(RuntimeError,'prior files restored'):self.m.update()
  self.assertEqual(self.snapshot(),self.before)
  self.assertEqual([c.args[1] for c in self.replace.call_args_list],[self.dockerfile,self.helper,self.dockerfile])
  self.assert_clean()
 def test_failed_restoration_identifies_manual_check_and_cleans_temporary_data(self):
  count=0
  def replace(source,target):
   nonlocal count
   count+=1
   if count in [2,3]:raise OSError('simulated replacement/restoration failure')
   return self.real_replace(source,target)
  self.replace.side_effect=replace
  with self.assertRaises(RuntimeError) as caught:self.m.update()
  self.assertIn(str(self.dockerfile),str(caught.exception));self.assertIn('manual verification required',str(caught.exception))
  self.assertEqual(self.helper.read_text(),'old helper');self.assert_clean()
 def test_first_replace_error_leaves_both_files_unchanged(self):
  self.replace.side_effect=OSError('simulated first replacement failure')
  with self.assertRaisesRegex(RuntimeError,'prior files restored'):self.m.update()
  self.assertEqual(self.snapshot(),self.before);self.assert_clean()
 def test_remote_git_uses_only_existing_psiu_https_credentials(self):
  self.run.return_value=subprocess.CompletedProcess([],0,stdout=b'approved-sha\trefs/heads/main\n')
  self.raw_git('ls-remote','--exit-code',self.m.REMOTE,'refs/heads/main')
  args=self.run.call_args.args[0]
  self.assertEqual(args[:6],['sudo','-u','psiu','-H','env','GIT_TERMINAL_PROMPT=0'])
  self.assertIn('credential.helper=store --file=/home/psiu/.config/mroya/git-credentials',args)
  self.assertEqual(args[-4:],['ls-remote','--exit-code',self.m.REMOTE,'refs/heads/main'])
  self.assertEqual(self.run.call_args.kwargs['stderr'],subprocess.PIPE)
if __name__=='__main__':unittest.main()
