# Google AI Studio workflow

One React application, one GitHub repository: `psiu7217/Mroya-web`. AI Studio owns visual iteration; Codex owns data coordination, API/authentication and verification. Git review is required even when Studio follows these instructions.

## Preview without Django

Use Node 22.12+ and `npm ci`, then `npm run dev`. This explicitly selects Design Mode. Studio can execute an optimized production build: use `npm run build:design` and preview `dist-design`, or configure its build environment with `MROYA_BUILD_TARGET=design` when it invokes the ordinary build command. This is a public compile-time choice, never a secret. `NODE_ENV=production` does not disable Design Mode. Do not infer the mode from `import.meta.env.DEV`, iframe hostname, query string or localStorage.

For a built preview: `npm run build:design` then `npm run preview -- --outDir dist-design --host 0.0.0.0`. If Studio does not expose build environment settings, use the explicit design script for its preview command. Never change the default production target just to make a preview work. Studio's runner controls its commands; inspect the preview banner to verify the selected target.

Open the small **Design states** control at bottom left. Scenarios: filled, user, empty, loading, error, guest (animated entry), guest-typing, guest-welcome, guest-login (Studio form in dialog), and guest-invite. `?scenario=guest` etc. are shortcuts in the design bundle only. Guest login is fictional; enter fictional values only. All original workspace sections remain available. Calendar/reminder/connection actions in this mode are local simulations. No backend or production credentials are needed.

## API authority and integration tasks

Read [BACKEND_CONTRACT](BACKEND_CONTRACT.md) before implementing any functional integration. It links the canonical Django API and Google OAuth documentation; Mroya API owns identity, user data and business logic. Reuse src/api/, hooks and providers with same-origin /api/v1/, Django session and CSRF. Never create a second API client/auth system, store browser secrets, invent endpoints or present demo data as real. Missing routes require explicitly described API work.

Studio may implement a small frontend integration when explicitly assigned, through existing typed contracts. API/auth architecture changes still require architectural review of the entire Git diff. Google Sign-In button integration is a separate task; the backend flow is already available. Keep Design Mode offline, including login previews.

## Safe editing scope

- Visual edits: `src/components/`, `src/pages/`, `src/index.css`, visual assets in `public/`.
- Keep package-lock.json in the repository; do not delete lockfiles or replace dependency configuration during a visual sync.
- Keep exported props and `src/types/workspace.ts` compatible. UI emits actions through props; it does not fetch, read cookies/storage, import demo sources, or implement authorization.
- Architecture requiring Codex review (including explicitly assigned Studio integrations): `src/api/`, `src/hooks/`, `src/providers/`, `src/demo/`, `src/types/`, `src/App.tsx`, `src/build.d.ts`, Vite/package configuration, tests, CI and deployment files.
- Demo fixtures/scenarios can be requested for a design task but changes need architecture review. Do not move demo logic into production components.
- Do not add Gemini SDK calls, API keys, secrets, server processes, mock authorization or production URLs to visual components.

Give Studio a bounded prompt naming the visual files and requiring existing props to be preserved. Instructions do not protect files automatically: always inspect the full Git diff.

## GitHub round trip

The [official Build Mode documentation](https://ai.google.dev/gemini-api/docs/aistudio-build-mode) describes GitHub import and two-way synchronization. In a new project use Add files (+) → Import from GitHub; for an existing project use Settings → GitHub to link this repository. Pull the reviewed branch before visual work, and push your visual changes back to a separate feature branch. Exact controls and availability depend on the Studio environment/account. Confirm the selected branch before syncing; do not send unreviewed changes directly to main.

If import/pull or branch selection is unavailable in your Studio UI, export its ZIP and reconcile only the intended visual changes against the current repository branch. Keep this repository as the source of truth; do not start a second independent frontend. Never overwrite the repository wholesale with generated/exported files.

Before pulling, save or push pending Studio work. Avoid simultaneous edits to the same visual file. Pull architecture updates first, then apply the design change. On conflicts, keep the reviewed API/provider/types/config versions and merge the intended layout change manually. A props conflict must be resolved with Codex and typechecked; do not delete contracts to make generated code compile.

## Review and verification

Run `npm run check:boundaries`, `npm run lint`, `npm test`, `npm run build:production`, `node scripts/check-production.mjs`, and `npm run build:design`. The markup regression test compares the original filled workspace with the reviewed baseline Git commit; a full Git history is needed (`git fetch --unshallow` for a shallow clone). Deliberate design changes should update the baseline assertion through review, not silently remove it.

Check new screens with every relevant scenario and desktop/mobile viewport. Verify navigation, scrolling, dialogs, touch controls and login layout. Inspect browser errors and failed assets. The boundary scanner is a heuristic; reviewers must also inspect imports, side effects, mode selection and dependency changes. CI checks props, boundaries, API/SSE behavior, fixtures without networking and absence of demo code in the production bundle.

Guest entry and the minimum live workspace are implemented. Release reviewed main within explicit user authorization using the existing independent Web helper/rollback procedure. Check HTTPS, guest state, same-origin routing and CSRF. When real credentials are not supplied, record positive account login as pending the owner’s manual check; do not create production test accounts or change user data. No automatic deployment is enabled by this CI.
