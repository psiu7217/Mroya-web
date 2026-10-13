# Mroya frontend architecture decision

Status: guest entry and minimum live workspace, 2026-10-14. Not approved for production cutover.

Mroya-web is the single React UI source of truth. The published **Mroya-api** Django application is the current integration contract. Personal Memory OS remains outside this frontend task; its engine is neither modified nor duplicated. Django is authoritative for accounts, data, access and persistence.

## Compile-time roots

`src/App.tsx` delegates to the Vite-selected `@mroya/entry`. Default build selects `providers/ProductionRoot`; explicit Design build selects `demo/DesignRoot`. Optimized Studio previews use an explicit design target even with NODE_ENV=production. A runtime query, localStorage value or user switch cannot import the other root. Production bundles are checked for demo markers. A design build additionally refuses known production hostnames; this is a deployment mistake guard, not the primary mode boundary.

The deployed application is unchanged. Production checks real session state before showing a guest shell or the shared live UI. Guest flows are static/local only; authenticated flows use Django history/send/memory/map. Google OAuth and unsupported capabilities are unavailable. Real Django end-to-end checks and separate release approval are still required. See [guest/session flow](GUEST_CHAT.md).

## Responsibilities

- components and pages: existing visuals, explicit props and callbacks; no transport or demo imports.
- types/workspace: stable presentation contract, including profile presentation; no import of a demo hook.
- demo: original fixtures and local simulation hook; source and scenarios without network access.
- providers: compile-time roots and live source composition.
- hooks/useSession: session loading/guest/user/error state and stale request handling.
- api and types/api: same-origin Django JSON/CSRF/SSE clients and real DTO contracts.

The existing filled workspace renders exactly the same markup as the original pinned Git baseline. Existing tokens, typography and responsive styles are retained in src/index.css; reduced-motion-aware greeting animation is appended. No router, state framework or second frontend was introduced. The small design scenario control is preview-only. Empty map rendering no longer assumes a first node exists.

## Further integration

The live adapter uses shared visual component contracts with actual history, chat and canonical memory DTOs. Further work includes richer provenance/detail presentation and the unsupported backend features. Retain all screens visually, honor capabilities and never silently show fixtures after a live failure. Real session authorization remains a Django responsibility. Verify real login/logout, reload persistence and interrupted chat recovery before a separate production cutover review.

See [backend inventory](BACKEND_CONTRACT.md) and [Studio workflow](AI_STUDIO_WORKFLOW.md). CI performs type, contract, transport, boundary and separate bundle checks without deployment. Review visual changes and architecture together before independently releasing Web. Existing production releases/rollback are untouched.
