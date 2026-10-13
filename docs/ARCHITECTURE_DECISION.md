# Mroya frontend architecture decision

Status: architecture preparation, 2026-10-13. Not approved for production cutover.

Mroya-web is the single React UI source of truth. The published **Mroya-api** Django application is the current integration contract. Personal Memory OS remains outside this frontend task; its engine is neither modified nor duplicated. Django is authoritative for accounts, data, access and persistence.

## Compile-time roots

`src/App.tsx` delegates to the Vite-selected `@mroya/entry`. Default build selects `providers/ProductionRoot`; explicit Design build selects `demo/DesignRoot`. Optimized Studio previews use an explicit design target even with NODE_ENV=production. A runtime query, localStorage value or user switch cannot import the other root. Production bundles are checked for demo markers. A design build additionally refuses known production hostnames; this is a deployment mistake guard, not the primary mode boundary.

The current deployed mock application is unchanged. The new production root implements session bootstrap/login/logout and an explicit integration-pending screen; it is intentionally not a substitute for a complete authenticated workspace. Do not deploy this branch before the real workspace adapter is implemented and reviewed.

## Responsibilities

- components and pages: existing visuals, explicit props and callbacks; no transport or demo imports.
- types/workspace: stable presentation contract, including profile presentation; no import of a demo hook.
- demo: original fixtures and local simulation hook; source and scenarios without network access.
- providers: compile-time roots and live source composition.
- hooks/useSession: session loading/guest/user/error state and stale request handling.
- api and types/api: same-origin Django JSON/CSRF/SSE clients and real DTO contracts.

The existing filled workspace renders exactly the same markup as the original pinned Git baseline. Existing colors, typography and responsive styles are retained in src/index.css. No router, state framework or second frontend was introduced. The small design scenario control is preview-only. Empty map rendering no longer assumes a first node exists.

## Next integration phase

Adapt live API DTOs to WorkspaceModel with real history, chat and canonical memory state; replace local mutation callbacks with server-backed or unsupported actions. Retain all screens visually, honor capabilities and never silently show fixtures after a live failure. Real session authorization remains a Django responsibility. Verify real login/logout, reload persistence and interrupted chat recovery before a separate production cutover review.

See [backend inventory](BACKEND_CONTRACT.md) and [Studio workflow](AI_STUDIO_WORKFLOW.md). CI performs type, contract, transport, boundary and separate bundle checks without deployment. Review visual changes and architecture together before independently releasing Web. Existing production releases/rollback are untouched.
