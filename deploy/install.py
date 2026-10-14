#!/usr/bin/python3 -I
"""Update existing Web helper/Dockerfile from reviewed main; never publish Web."""
import fcntl, os, pathlib, subprocess, tempfile
CHECKOUT = pathlib.Path('/home/psiu/mroya-web-deployment')
CONFIG = pathlib.Path('/etc/mroya-web-deploy')
STATE = pathlib.Path('/var/lib/mroya-web-deploy')
REMOTE = 'https://github.com/psiu7217/Mroya-web.git'
def git(*args):
    result = subprocess.run(['sudo', '-u', 'psiu', '-H', 'env', 'GIT_TERMINAL_PROMPT=0',
        'git', '-c', 'credential.helper=', '-c',
        'credential.helper=store --file=/home/psiu/.config/mroya/git-credentials',
        '-C', str(CHECKOUT), *args], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode: raise RuntimeError('Unable to read reviewed deployment checkout')
    return result.stdout
def update():
    if CHECKOUT.is_symlink() or CHECKOUT.owner() != 'psiu' or (CHECKOUT / '.git').owner() != 'psiu':
        raise RuntimeError('Deployment checkout must belong to psiu')
    if git('remote', 'get-url', 'origin').decode().strip() != REMOTE:
        raise RuntimeError('Deployment checkout must use the official HTTPS origin')
    if git('branch', '--show-current').strip() != b'main' or git('status', '--porcelain').strip():
        raise RuntimeError('Review a clean main before installing the helper')
    sha = git('rev-parse', 'HEAD').decode().strip()
    sources = [('deploy/Dockerfile', CONFIG / 'Dockerfile', 0o644),
               ('deploy/mroya-web-deploy', pathlib.Path('/usr/local/sbin/mroya-web-deploy'), 0o755)]
    staged = []
    try:
        for source, target, mode in sources:
            if not target.is_file() or target.is_symlink() or target.owner() != 'root':
                raise RuntimeError('Existing root-owned Web installation required')
            fd, name = tempfile.mkstemp(prefix='.mroya-web-update-', dir=target.parent)
            staged.append((pathlib.Path(name), target))
            with os.fdopen(fd, 'wb') as stream: stream.write(git('show', sha + ':' + source))
            os.chown(name, 0, 0); os.chmod(name, mode)
        # Validate all inputs before replacing anything; individual replacements are atomic.
        subprocess.run(['bash', '-n', str(staged[1][0])], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for temporary, target in staged: os.replace(temporary, target)
    finally:
        for temporary, _ in staged: temporary.unlink(missing_ok=True)
    print('Installed Web helper/Dockerfile from main ' + sha)
    print('No containers started. Compose, Nginx, legacy rollback and old artifacts unchanged.')
def main():
    if os.geteuid() != 0: raise RuntimeError('Run as administrator')
    with (STATE / 'deployment.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        update()
if __name__ == '__main__':
    try: main()
    except Exception: raise SystemExit('ERROR: Web helper installation failed; no deployment performed.')
