# Mroya Web

Single React/Vite frontend for Mroya, designed to stay editable in Google AI Studio. This branch adds guest entry and a minimum session-backed workspace; it does not change the deployed application or approve a production cutover.

## Local design preview

Node 22.12+ and npm are required. Run `npm ci` then `npm run dev`. No Django, real account or API key is needed. Use **Design states** at bottom left to preview guest/typing/welcome/login/invite, user, empty, filled, loading and error states. For an optimized Studio preview use `npm run build:design`; see [AI Studio workflow](docs/AI_STUDIO_WORKFLOW.md).

## Verify

```sh
npm run check:boundaries
npm run lint
npm test
npm run build:production
node scripts/check-production.mjs
npm run build:design
```

The markup regression test needs the pinned original Git commit (full history; `git fetch --unshallow` if necessary). GitHub Actions are intentionally disabled: use these checks explicitly when relevant. The existing Web deploy helper performs only its local Nginx HTTP smoke check.

Default production builds contain the real same-origin session/CSRF/API foundation and no demo root. The minimum live workspace is connected to existing API contracts: **real Django end-to-end verification and separate release review are required before deployment**. Existing production releases and rollback remain unchanged.

Read [guest/session behavior and remaining checks](docs/GUEST_CHAT.md), [architecture](docs/ARCHITECTURE_DECISION.md), [backend contracts and unsupported features](docs/BACKEND_CONTRACT.md), and [Studio review/synchronization workflow](docs/AI_STUDIO_WORKFLOW.md) before editing data logic or publishing.
