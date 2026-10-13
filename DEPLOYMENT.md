# Mroya Web deployment

Permanent command, without arguments:

```sh
sudo /usr/local/sbin/mroya-web-deploy
```

Optional manual rollback:

```sh
sudo /usr/local/sbin/mroya-web-rollback
```

## Existing mechanism, reduced to Web only

The helper uses the existing `/opt/mroya-web` Git repository, `/etc/mroya-web-deploy` runtime configuration, `/var/lib/mroya-web-deploy` release state and Compose project `mroya-web`. No parallel installer, service, project or deployment daemon is introduced.

1. Fetch GitHub **main** and archive that exact commit. Local dirty files are not built or overwritten; feature branches, including PR #2, are never selected.
2. Build the React production image using the installed Dockerfile and Nginx configuration. Docker layer cache and npm lockfile remain. Design target is explicitly disabled for this build. Typecheck/tests remain in CI rather than repeating during deployment.
3. Tag the candidate and run only `docker compose -p mroya-web ... up -d --no-deps --pull never web`.
4. Retry a single HTTP check of `/` inside the Web container at `127.0.0.1:8080` until Nginx serves it. No browser suite, external DNS/HTTPS checks, API requests or Traefik metadata inspection are part of deployment.
5. On failure after the live switch, restore the retained Web image **and its Compose artifact**, then check the same HTTP homepage. Build failures occur before the switch. Pending state permits recovery after an interrupted process.

A successful release retains current and previous image tags plus their Compose files under `/var/lib/mroya-web-deploy/releases/`; the images include the built assets and Nginx configuration. The state record is `last-success.json`; an interrupted transaction retains `pending.json`. Logs use the existing `deployment.log`. The existing per-Web lock prevents overlapping update/rollback/install operations.

No global fingerprints, neighbor/container snapshots, revision-label/ID/start-time comparisons, image scans, network/mount inspection, API/landing/database checks or global Docker operations remain. An inspection of the single named Web container reads only its current image to retain the rollback artifact; it is not a comparison/check of container identity. No volumes are removed, and there is no down/prune. Runtime Compose and Nginx routing are not updated from GitHub: existing app.heymroya.com and /api/v1/ routing are preserved.

## Approved release policy

Main must contain the approved deployable frontend before invoking the command. GitHub sync and CI review remain the release boundary; the helper does not fetch/open/test/merge PRs. The current open guest PR #2 still needs its separately documented real Django verification before cutover. **Do not run a frontend update merely to test this helper.** Missing lockfile/build errors leave the current Web serving its old image.

The simplification PR is based on PR #2 to keep its code intact; its diff contains deployment files/docs/CI only. This is a Git review relationship, not a second deployment path. Runtime installation below does not publish PR #2 or change the live React image.

## One-time update of the installed helper

The existing preparation installer was updated in place. As administrator on the server:

```sh
sudo python3 -I /home/codex/mroya-web-preparation/install.py
```

It installs only `/usr/local/sbin/mroya-web-deploy`, `/usr/local/sbin/mroya-web-rollback` and `/etc/mroya-web-deploy/Dockerfile`. It backs up these three files in the existing Web state directory and refuses a missing initial installation. It starts no containers and leaves Compose, Nginx, source checkout, sudoers, Traefik and other projects unchanged. Administrative rights are needed for this one-time file replacement; the existing no-argument sudo permission handles future Web updates.

To revert the helper change itself, copy the backed-up files to the same three paths as root. This is separate from rolling back a frontend release. Frontend release rollback needs no Git checkout reset or rebuilding.

## Verification

`python3 -m unittest discover -s deploy -p test_deploy.py -v` exercises success, build failure, HTTP-triggered rollback, manual rollback, interrupted recovery and exact Git archive selection using fake command execution. It never starts containers. Existing frontend CI checks remain, with this scoped deployment test added. No unfinished frontend was deployed for verification.
