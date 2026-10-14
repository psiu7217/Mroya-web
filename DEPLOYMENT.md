# Mroya Web deployment

One reviewed GitHub main, one clean deployment checkout, one publication command. GitHub Actions are absent; deployment never opens/merges PRs. Studio publishes directly to main; review its exact diff before release. Codex changes use a separate branch/PR.

## Flow and ownership

HTTPS main update → lockfile/preflight → production Docker build → Web-only Compose update → local Nginx HTTP check.

The dedicated checkout is /home/psiu/mroya-web-deployment, owned by psiu. It was **absent** during read-only diagnosis on 2026-10-14; the installation command below creates it explicitly. Git uses sudo -u psiu -H, GIT_TERMINAL_PROMPT=0 and the existing store credential helper /home/psiu/.config/mroya/git-credentials. No new token/SSH/proxy/VPN setup is needed. Never read, copy or print that file's contents.

The helper checks owner, official HTTPS origin, main branch and a clean worktree, then pulls --ff-only. HEAD must equal the fetched main SHA; local commits ahead of main also stop publication. No reset/clean/force operations. /opt/mroya-web and Codex/Studio working copies are not synchronized or changed.

Root owns the helper, Docker operations and runtime files. The existing /var/lib/mroya-web-deploy/deployment.lock is retained for flock. No other state files are used.

## Production build and runtime

A temporary /tmp/mroya-web-build.* context contains explicitly selected files archived from the exact main SHA, plus the installed /etc/mroya-web-deploy/Dockerfile and nginx.conf. It is removed on exit. No retained archive/release directory is created. The repository cannot overwrite runtime Nginx.

Before publication: a tracked package-lock.json is required; Docker checks its root dependency declarations against package.json, then npm ci validates/installs locked dependencies. Missing/incompatible locks stop before any live image switch. Do not generate/restore a lock automatically during deployment or substitute npm install: restore the last matching lock in Git, or commit a reviewed regenerated lock after an intentional dependency change.

The existing build stage runs npm run lint, MROYA_BUILD_TARGET=production npm run build:production, and node scripts/check-production.mjs. Typecheck/build/bundle checks run without network after npm ci. The Vite Production/Design entrypoint boundary is unchanged; bundle markers are only an additional check. Full tests, boundary scans and Design builds remain explicit development/review commands.

Build produces mroya-web:<exact SHA>. Only after all build checks pass, tag it mroya-web:production, matching the existing base Compose image. Thus ordinary Compose restarts use the same current image; no temporary override can silently select an older base image.

Use the installed /usr/bin/docker and /usr/libexec/docker/cli-plugins/docker-compose, existing Docker host/config, /etc/mroya-web-deploy/compose.yaml and empty.env, project mroya-web, service web. Run only up -d --no-deps --no-build --pull never web. Then retry only exec -T web wget against http://127.0.0.1:8080/ (30 attempts, 3-second HTTP timeout, 2-second pauses). There are no external HTTP/API/browser/account checks inside publication.

Permanent publication command (only after separate release authorization):

```bash
sudo /usr/local/sbin/mroya-web-deploy
```

## One-time helper update — not publication

**This PR is not installed or deployed. Merge/review the PR manually first. Do not execute the following against the old main installer.** The command is based on the confirmed existing /home/psiu parent, working HTTPS credentials and currently absent Web checkout. It explicitly clones that missing checkout; it does not assume an unverified directory exists. If the checkout has appeared in the meantime, stop and review it rather than deleting/replacing it.

```bash
sudo bash -c 'set -e; sudo -u psiu -H env GIT_TERMINAL_PROMPT=0 git -c credential.helper= -c "credential.helper=store --file=/home/psiu/.config/mroya/git-credentials" clone --branch main https://github.com/psiu7217/Mroya-web.git /home/psiu/mroya-web-deployment; python3 -I /home/psiu/mroya-web-deployment/deploy/install.py'
```

The existing deploy/install.py reads committed files from the clean, correctly owned official main checkout and prints their source SHA. Before staging files it compares HEAD with HTTPS ls-remote refs/heads/main using psiu’s existing credential helper; a mismatch stops installation and asks for synchronization/review, without pulling or resetting the checkout. It prepares both new files, checks Bash syntax and saves the previous bytes/ownership/permissions in operation-local temporary files before replacing anything. Each replacement is individually atomic; the pair is not a single atomic filesystem operation. On replacement failure it attempts to restore already replaced files; failed restoration explicitly identifies the path requiring manual verification. All operation-local temporary files are cleaned up on ordinary success/failure; abrupt process termination is not a crash-recovery transaction. It creates no permanent backup and starts no containers. Compose/Nginx are never installed/modified by it. Subsequent helper updates use the same reviewed installer from an explicitly synchronized clean main checkout; do not execute an unreviewed installer from Studio.

Installed legacy /usr/local/sbin/mroya-web-rollback remains untouched but is **not supported for this new helper**. Do not use it with the new workflow: it still refers to old state. Old images, helper backups, releases/, pending.json/last-success.json (where present) and logs are left in place, never deleted or migrated.

## Failure handling

Errors name the stage with a brief safe message; Git error output is suppressed to avoid exposing credential-bearing remote diagnostics. No credentials, cookies, production .env or API payloads enter the build context/logs. Before image publication, build failures leave the live container and stable image tag untouched.

After the tag/Compose switch, failures are explicit and **no automatic rollback occurs**. The stable tag can already point to the new image even if Compose startup failed. Do not claim the previous image was restored. Review/fix or git revert the bad change, publish the correction to main, then repeat the ordinary command after release authorization. This is not an automatic rollback system.

No image deletion, volumes removal, down/prune, global Docker restart, foreign-resource snapshots or checks. No Django migrations/DB smoke tests are copied to Web.

## Diagnosis and checks

Confirmed on Ubuntu: installed Web helper matched the previous repository helper; helpers are root:root 0755; runtime Compose/Dockerfile/Nginx are root-owned readable files, docker-cli is root-only. Installed Compose selects mroya-web:production with unless-stopped, external traefik-proxy, app.heymroya.com HTTPS labels and its existing healthcheck. Actual Web container has no mounts/published host ports/custom SecurityOpt and ReadonlyRootfs=false; these settings are preserved. The Nginx /api/ fallback remains unchanged; same-origin API is provided by the existing independent routing, not by a new proxy configuration.

psiu exists and belongs to Docker; sudo -u psiu -H works under psiu's account. Its credential file metadata is psiu:0600; contents were not read. HTTPS ls-remote returned the checked Web main 3b3ab358168db3088ff4743eb38bf81f305139e8 without a prompt. Docker supports named build contexts, but a temporary explicitly selected context avoids changing installed Nginx handling. Compose is v2.40.3. Current Web image is mroya-web:production and container healthy. It has no reliable Git revision label, and protected legacy state was not read; current published SHA is not inferred from checkout or image IDs.

The API reference was read at deployment checkout d1e918ee4dfbd17a0be2f04aa9e54e8ad171f08d; installed API Bash helper matched that pattern. Web shares HTTPS user/clean main/flock/Web-only update/no rollback behavior; React replaces the API's Python/Django checks and migrations with npm/typecheck/build/bundle checks and container-local Nginx HTTP.

Run python3 -m unittest discover -s deploy -p test_deploy.py -v and bash -n deploy/mroya-web-deploy. Tests use fake Git/sudo/Docker/Compose and temporary paths; installer tests replace only temporary files. They check checkout refusal, exact main, locked build refusal, Web-only commands, HTTP retry and explicit failure without rollback. No real Docker build/deployment, production API or credential contents are used. Installer syntax checks and atomic replacement are covered without installing it.

No Actions, CI/CD, scheduler, new service or credential was added. Real Docker build and administrative installation remain unexecuted in this PR.

Review validation: 14 fake deployment/installer tests, Bash/Python syntax, actual Node lock metadata check, TypeScript, boundaries and both frontend builds passed on Ubuntu. The full frontend suite is 28/29: the unchanged SSR test still pins 1fe0f3b and fails against the already approved Studio PNG logo in main. This PR changes neither UI nor that historical baseline; reconcile the deliberate visual baseline in a separate reviewed change.
