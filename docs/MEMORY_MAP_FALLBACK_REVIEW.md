# Memory Map / Notifications review — 2026-10-25

Reviewed Web main `0b7afba87179a1d2b8b3adefaf87d67806d2ebfd` and API main
`08532d3ad324b10760f4d8c13f29bde19dab2de2`. No merge or deployment performed.

## Notifications: release dependency, not a wrong client URL

`src/api/client.ts` calls the GET/PATCH `me/notifications/settings/` contract.
API main's `config/urls.py` includes `apps.api.urls` under `/api/v1/`, but
neither the notification routes nor `apps/notifications` exist in that main.
They already exist in [API PR #35](https://github.com/psiu7217/Mroya-api/pull/35),
still open at `f1ec72e4a7f386b499c1f58b6d2bb619f7f9326c`.
Its preferences view uses the existing authenticated endpoint decorator,
server-owned `request.user`, persistent NotificationPreference and Telegram
binding/configuration/worker readiness. PATCH retains CSRF protection.

Read-only public probes returned Django-shaped JSON 404 for settings and
401 for `/api/v1/me/`, with `Cache-Control: no-store, private`. This agrees
with an unpublished route, rather than a frontend spelling/auth workaround.
The deployed commit was not accessible to this SSH account, so its exact SHA
is not claimed. This is more than a deployment delay: the implementation is
not yet merged into API main. Do not add another endpoint or fabricate success.

Existing notification transport/controller/DTO tests pass. Positive checks
against real account settings and actual Telegram delivery require reviewing,
merging and deploying PR #35 (including migration/configuration/worker), followed
by owner acceptance. Those release operations were not authorized here.

## Memory Map

The previous Pixi initialization specified `preference:["webgl"]`. That array
excludes every other backend. Driver errors such as EGL_NO_CONFIG indicate
the browser cannot supply a working context; application code cannot repair
the driver. The application defect was making the graph depend entirely on it.

The installed, locked PixiJS 8.22.0 includes CanvasRenderer. Initialization now
uses `["webgl","canvas"]`. Pixi handles unavailable WebGL; if a supported
WebGL renderer fails during actual initialization, dispose the failed stage/app
and attempt one fresh Canvas-only application. Remember that failure for the
page lifetime, so reopening does not retry the failing driver. Aborted
initialization cannot attach a canvas or start map listeners/layout.

Pixi's Canvas text batcher still constructs a shader descriptor whose precision
probe requests WebGL. Its support probe catches exceptions, but that later
probe does not. `canvasAdapter.js` wraps only Pixi-created canvas instances via
the public DOMAdapter API: WebGL acquisition exceptions become null; 2D and
other errors propagate. Browser prototypes and the browser's global APIs are
unchanged. This also covers environments where every WebGL getContext throws.

Both modes use the same Pixi scene, d3 forces, canonical nodes/edges, camera,
pointer capture, wheel/pinch handling, search, local filtering, details,
related-node navigation, Memory/Chat actions, theme and PNG export. There is
no second layout, store, API request, renderer dependency or duplicated engine.
Normal destruction stops the simulation/animation frames, aborts handlers,
disconnects the observer, revokes export URLs and destroys the Pixi app.

The view now imports only force defaults statically; Pixi/d3 load when the map
mounts. Production browser checks confirm the renderer chunk is absent from
Chat's initial requests. Empty/API-error states take precedence over renderer
failures; the final renderer error describes both WebGL and 2D failure.

## Firefox layout warning

No `node.js` source exists in the app. The map reads host dimensions after
mount, uses ResizeObserver, and reads pointer bounds on interaction; theme
tokens are read when presentation updates. CSS remains a normal stylesheet
dependency of the Vite entry. No confirmed pre-stylesheet application layout
defect was found. The reported warning did not reproduce in Firefox testing.
The source of the original `node.js:416:1` cannot be identified without its
full source URL/stack; it is not proven to be browser-internal either.
No artificial delay or global startup/CSS change was introduced.

## Verification

- `npm ci`, TypeScript (`npm run lint`), production build, Design build,
  boundary scan and `scripts/check-production.mjs` passed. Vite retains its
  existing large application-chunk advisory; no new dependencies/lock changes.
- All 437 repository tests pass; renderer/controller regressions cover fallback,
  bounded retries, reopening, pointer selection, pan/zoom/touch pinch,
  theme preservation, cancellation, empty payload and API error priority.
- Real production bundle in Playwright Chromium and Firefox: normal WebGL2,
  WebGL returning null, absent WebGL constructors, every WebGL getContext throwing,
  and support probe succeeding while the actual renderer context throws.
  All 16 browser scenarios pass. Canvas cases have nontransparent graph pixels; search/details,
  wheel/pan, Open Memory and reopening work. Graph fetched once per session;
  failed driver is not retried on reopening; no page errors.
- Both browsers: 390×844 Light Canvas viewport, empty graph and map API 503.
  Dark desktop and Light mobile screenshots inspected. Firefox emits Pixi/GL
  context-release and texture warnings in GPU scenarios; no early-layout warning.
- Browser/API fixtures are synthetic and intercepted only in the test browser,
  never shipped or substituted in application code. No real user data changed.

Limits: actual production login/settings/delivery, Safari/iOS, physical touch
hardware and device-driver performance remain owner acceptance checks. This
change handles normal unavailable contexts and real renderer creation failures.
Runtime context loss after a successfully running WebGL scene also remains
Pixi's existing restoration behavior, rather than a new live backend switch.

Changed files: `src/components/MemoryMapView.tsx`,
`src/components/memory-map/renderer.js`, `src/components/memory-map/canvasAdapter.js`,
`src/i18n/locales/en/memory.json`, `src/i18n/locales/ru/memory.json`,
`tests/memory-map-presentation.test.mjs`, `tests/memory-map-selection.test.mjs`,
`tests/memory-map-canvas-adapter.test.mjs`, and this report.
