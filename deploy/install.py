#!/usr/bin/python3 -I
"""Update the existing Mroya Web helper only; never deploy or change routes."""
import ast,fcntl,os,pathlib,shutil,subprocess,time
SOURCE=pathlib.Path('/home/codex/mroya-web-preparation/source/deploy')
CONFIG=pathlib.Path('/etc/mroya-web-deploy')
STATE=pathlib.Path('/var/lib/mroya-web-deploy')
def update():
 if os.geteuid()!=0:raise RuntimeError('Run this existing installer with sudo as administrator')
 helper=SOURCE/'mroya-web-deploy';ast.parse(helper.read_text())
 targets=[(helper,pathlib.Path('/usr/local/sbin/mroya-web-deploy'),0o755),(helper,pathlib.Path('/usr/local/sbin/mroya-web-rollback'),0o755),(SOURCE/'Dockerfile',CONFIG/'Dockerfile',0o644)]
 if not all(target.is_file() for _,target,_ in targets):raise RuntimeError('Existing Web installation is required')
 backup=STATE/('helper-backup-'+time.strftime('%Y%m%dT%H%M%SZ')+'-'+str(os.getpid()));backup.mkdir(mode=0o700)
 for _,target,_ in targets:shutil.copy2(target,backup/target.name)
 try:
  for source,target,mode in targets:subprocess.run(['/usr/bin/install','-o','root','-g','root','-m',oct(mode)[2:],str(source),str(target)],check=True)
 except BaseException:
  for _,target,_ in targets:shutil.copy2(backup/target.name,target)
  raise
 print('Updated existing Mroya Web helper. No containers started; Compose, Nginx and source checkout unchanged.')
 print('Helper backup: '+str(backup))
 print('Permanent update command: sudo /usr/local/sbin/mroya-web-deploy')
def main():
 if os.geteuid()!=0:raise RuntimeError('Run the existing installer with sudo as administrator')
 with (STATE/'deployment.lock').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  update()
if __name__=='__main__':main()
