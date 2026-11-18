# Memory Map regression review — 2026-10-25

Reviewed Web main `0b7afba87179a1d2b8b3adefaf87d67806d2ebfd` and API main
`08532d3ad324b10760f4d8c13f29bde19dab2de2`. No PR merge or deployment performed.
The final Web diff has no Canvas/SVG fallback, dependency change or graph redesign.

## History and cause

- Original map PR #21: merge `0a71e827acc92b68052e4a617f5e8ecae5c16f2b`.
- Lazy map PR #41: merge `11201f5085d5c8d4a49fc430c3375dbe35c9e30a`.
  Its renderer diff moves force defaults into their own module and adds an
  AbortSignal guard before/after async Pixi init. WebGL init options do not change.
- Localization PR #50: merge `c33a366410c2b637a81758bace8e1ccd117d57a7`.
  It restores the static renderer/defaults import in the view. The renderer itself
  is byte-identical between PR #41 and current main.

PR #50's confirmed loading regression is fixed by importing `forceDefaults.js`
statically and retaining the dynamic renderer import in the effect. Localization,
asynchronous cancellation and existing scene controls remain intact. A production
bundle regression test traverses actual chunk imports and checks module IDs: Pixi,
d3-force and renderer.js are absent from the initial static dependency closure;
the renderer is reached through a dynamic import.

EGL_NO_CONFIG / EXHAUSTED_DRIVERS means that Firefox failed to obtain a usable
driver context. The timing after lazy loading alone does not establish causality.
Same-browser comparison of five real renderer snapshots (PR #21, parent of #41,
#41, main, fixed) did not reproduce a WebGL regression: all work with WebGL2 and
all fail with WebGL disabled. Without a fallback, unavailable browser WebGL cannot
render this graph. This task intentionally retains WebGL-only rendering.

One independent cleanup defect was confirmed: the old rejection path only cleaned
up if app.renderer existed. Pixi assigns that property after its awaited internal
renderer initialization. A rejection beforehand therefore left its stage and any
partially acquired context outside that cleanup path. This is fixed, but is not
claimed as the cause of the owner's EGL driver failure.

## Initialization and diagnostics

`initialization.js` owns the canvas supplied to Pixi. It records dimensions and
native `webglcontextcreationerror.statusMessage`, tracks acquisition on this canvas
only, and restores the canvas method/listener after initialization. On rejection
it destroys the stage even if app.renderer was never assigned and releases an
acquired context. A late successful init after cancellation is destroyed before
attachment. There are no new automatic retries or extra support probes.

Developer console filter: `[Mroya Memory Map]`.

- `phase=module-load`, `kind=chunk-load`: dynamic JS import rejected.
- `phase=renderer-init`, `kind=webgl-unavailable`: explicit Pixi unsupported-WebGL
  result, native creation failure, or an exception during context acquisition.
- `phase=renderer-init`, `kind=renderer-init`: other application/renderer failures.

The original Error is logged as an object. Initialization wraps it with Error.cause
and includes dimensions/status; the browser can expand original stack/cause.
Firefox's native failed-module-import Error sometimes has an empty stack: its
original message/object is preserved rather than fabricating a stack. Pixi itself
may reduce a failed support probe to `No available renderer...`; this is retained
alongside the browser's own WebGL warnings. No graph/user data is logged. Normal
unmount cancellation is silent. UI messages distinguish the three failures in
RU/EN, expose no stack and keep empty/API-error states separate.

## Browser verification

Historical comparison used the actual renderer/graph helper sources from each
Git revision with the same pinned Pixi 8.22/d3 dependencies, mounted in an isolated
browser host. It compares rendering/lifecycle, not every historical application
build. Chromium and Firefox both passed five create/draw/select/zoom/fit/destroy
cycles for all five revisions. Scene canvases are removed each time. Context
tracking shows seven acquisitions/six releases across five cycles, leaving the
same one Pixi shader-probe context after every cycle; there is no cumulative
increase and the old/fixed renderers behave identically on this metric.
WebGL-disabled cases fail consistently in all revisions (20 comparison cases).

The final production bundle passed 19 scenarios in real Playwright Chromium and Firefox
with synthetic API responses. Checks include lazy network loading, normal WebGL2,
null/throwing context acquisition, real-context failure after a successful probe,
non-WebGL application init failure, blocked JS chunk, Dark desktop, Light 390x844,
empty graph and map API 503. Normal mode verifies search/detail, Global/Local,
Zoom/Pan/Fit, PNG export (desktop), Open Memory and reopening without graph refetch.
Failure modes verify correct UI and original developer-console error metadata.
Firefox was also launched with its actual `webgl.disabled=true` preference: a
plain about:blank page independently returned null for WebGL and WebGL2, and the
application showed its specific WebGL message without a retry loop or fallback.

TypeScript, all 439 repository tests, production build, Design build, boundary
scanner and production fixture-isolation check pass. Vite's pre-existing large
application-chunk advisory remains. Browser fixtures are test-only; no production
test users or real account mutations were performed.

## Notifications

`src/api/client.ts` uses the correct GET/PATCH `me/notifications/settings/` contract.
API main includes apps.api.urls under /api/v1/, but has no notification routes/app.
The existing implementation is in open [API PR #35](https://github.com/psiu7217/Mroya-api/pull/35).
It uses server-owned request.user, persistent preferences, session authentication,
CSRF for writes, and the existing Telegram binding/configuration/outbox.

Public read-only probes return JSON 404 for settings and 401 for /api/v1/me/.
The route is not merely awaiting deployment: its implementation is not merged into
main. PR #35 also had conflicts against main. Its branch is synchronized with
current main, preserving both notification and current Notes/Intelligence routes,
both test suites and current deployment documentation. No duplicate API is added.
Backend validation and worker acceptance are recorded in that PR.

## Firefox layout warning / limits

The reported early-layout warning did not reproduce. Host dimensions are read
after mounting, resize uses ResizeObserver, pointer bounds are measured on user
interaction and presentation reads theme tokens. CSS remains an ordinary Vite
stylesheet dependency. The original node.js:416:1 source URL/stack was not supplied;
its browser/extension/application origin cannot be determined from that line alone.
No global startup/CSS delay or workaround was introduced.

The owner's exact Firefox profile/driver and authenticated production settings /
Telegram delivery remain acceptance checks after separately approved release.
Safari/iOS and physical touch hardware were not tested. Synthetic browser/API
tests are not evidence of a production account login or a repaired device driver.

Changed Web files: MemoryMapView.tsx; memory-map/renderer.js and initialization.js;
RU/EN memory.json; memory-map-presentation, memory-map-selection,
memory-map-initialization and memory-map-lazy tests; this report.
