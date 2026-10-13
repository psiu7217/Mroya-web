# Architecture preparation verification

Test environment: isolated Ubuntu checkout on mroya-server, Node 22, React 19/Vite 8. No production release, backend code, database or container operations were performed.

15 regression tests, typecheck, both builds and boundary/bundle scans passed. Fresh npm ci on this server encountered npm registry network timeouts; existing preparation dependencies were used for local verification. CI performs a fresh lockfile install separately.

## Automated checks

TypeScript checks explicit presentation props and callbacks; invalid access to internal setters is a compile-time regression assertion. Transport tests cover CSRF rotation, same-origin credentials, 401 guest vs server failure, no automatic POST retry, history pagination, canonical provenance, invalid JSON/session, replay UUID retention, native browser fetch receiver and interrupted/error/UTF-8 SSE. Design source tests forbid fetch entirely. Host/query tests and production bundle inspection verify separation. SSR verifies exact original filled workspace markup and all sections in filled/empty scenarios against pinned baseline d869b42.

## Browser checks

Optimized Design build served from a temporary loopback-only server, without Django, reached chat, calendar, reminders, memory, map and connections. Guest fictional login, user, empty, loading and error scenarios rendered. Tested mobile 390×844 menu and all sections; no Design console errors/warnings. Empty map renders safely. Existing src/index.css is unchanged.

The local Production build opened with `?scenario=user&demo=true` stayed on actual session loading/guest login after a test-server 401; there was no demo switch. Browser testing caught an unbound native fetch call; the fix and regression test are included. Preview access logs recorded `/api/v1/me/` only on the Production preview port and zero API requests from Design. This does not substitute for real account end-to-end tests in the next phase.

## Remaining validation

Studio-specific runner settings and GitHub controls must be checked in the user's Studio project; current official workflow is documented with fallback. Real login/chat/persistence/recovery and capability-driven live UI are not end-to-end connected yet. No production changes or real user mutations were used to claim success. A separate cutover review is required.


## Guest/session branch (2026-10-14)

23 tests, typecheck, boundary scan, production demo-marker scan and both builds pass locally. Base was refreshed to synchronized Studio main 1fe0f3b; filled-workspace markup comparison normalizes only unique SVG gradient IDs. Studio logo paths/colors remain unchanged, and the mobile disappearance caused by duplicate gradient IDs is fixed.

An isolated loopback HTTP fixture exercised the production transport end to end: wrong/correct password, session cookie, SSE response, server history after reload, memory/map, unavailable features, logout and /me server error with retry. Guest sends and section gates occurred before any auth POST and made no personal API request. Design guest states made zero API requests. Mobile 390x844 passed guest navigation/gate/dialog checks with no horizontal overflow; Username focus, Tab/Shift+Tab wrapping, Escape and trigger focus restoration were observed. Final browser console was clean. Fixture credentials/data are not real Django accounts or production data.

Real Django HTTPS end-to-end checks using an approved test account remain a release requirement. Production deployment was not performed.

CI caught that the latest Studio commit 1fe0f3b removed package-lock.json. The unchanged manifest was matched to the last reviewed lockfile, which is restored in this PR so fresh npm ci remains reproducible.
