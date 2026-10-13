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
