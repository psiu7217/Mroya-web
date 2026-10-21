# Google privacy controls — staged integration
Depends on the matching Mroya-api review branch, not deployed. No OAuth URL, scope, client ID, approved branding or public domain is changed.

The existing MroyaApi transport owns session/CSRF requests. LiveWorkspaceSource exposes privacy settings/consent/request methods; usePrivacySettings handles account-local state and aborts obsolete responses. WorkspaceView passes a typed PrivacyPresentation to presentation-only controls. There is no second fetch/auth client or component-side persistence.

Connected accounts explains Calendar list/event permissions before authorization, one-time initial two-way sync, separate automatic sync and the absence of Gmail/Drive grants. Studio's illustrative design copy and all CSS remain unchanged. A live privacy panel links to the existing legal URLs, separates optional AI consent from synchronization, shows provider approval availability, permits withdrawal and records honest review-pending privacy requests. No completed-erasure or automatic-revocation success is fabricated. The disconnect notice uses the actual Backend revoked result; unknown/legacy receipts are not described as confirmed revocation.

Deletion buttons are explicitly requests, not implemented automatic erasure. The UI states that imports, memory and backups require review, presents actual request IDs and never replaces failed API responses with local success. Backend absence produces an unavailable state. Google and AI-provider terms still require owner decisions.

Release remains blocked by cross-store/derived-data erasure, historical diagnostics, retention/backups, provider terms and live OAuth verification. Do not merge/deploy this branch as if these mechanisms were complete. See landing PR #1 docs/oauth-verification for target legal text, GAP analysis and release matrix.

Verification used Node 22.23.3 tooling bundled for Mroya and existing server-side Mroya dependency installations; no dependency installation on Windows. The repo has no canonical npm lockfile; the existing deployment fallback is still the dependency-reproduction limitation, not proof of a fresh network npm ci in this review.

Test evidence is centralized in landing PR #1: docs/oauth-verification/TEST-EVIDENCE.md. No full-suite green or complete erasure claim is made.
