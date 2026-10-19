# Timezone frontend preparation — Backend contract pending

**Not ready to merge or deploy.** The owner confirmed that the timezone API is still in development. The inspected API main still rejects timezone in PATCH preferences and does not publish a persistent timezone-write route. No route, HTTP method, request shape, capability flag or response envelope is invented in this branch.

## Prepared behavior

- `src/hooks/useUserTimezone.ts` owns account-scoped confirmed timezone and draft, one initial browser hint, serialized manual edits, confirmation/error/retry, stale response protection and logout cleanup.
- `WorkspaceSource.timezone` is an **internal frontend port**, not an HTTP API contract. It declares two semantic operations: `initializeIfUnset(zone, signal)` and `save(zone, signal)`, returning a confirmed `ApiUser`. The live source deliberately does not implement this port yet. No new HTTP requests are sent in the current branch.
- Missing port is explicit: Profile remains read-only with an integration notice. Empty timezone shows a Profile action; no fake Saved or local-only production preference is substituted. Synthetic tests inject a port to exercise the prepared UI/state.
- The first authenticated mount (password login, Google-created user or restored session) may initialize an empty timezone from `Intl.DateTimeFormat().resolvedOptions().timeZone`. Saved timezone skips detection/writes. StrictMode abandoned setups do not send another initialization. Initial retries retain **only-if-unset**, including after a lost response; only an explicit manual choice permits an unconditional save.
- Manual changes are serialized. A late initialization response cannot erase a newer draft. A failed write preserves draft and requires explicit Retry; Retry reads the existing session/me first and avoids repeating an already applied choice. Mismatched user/confirmation never produces Saved.
- Profile uses the existing dropdown/style, the full runtime-supported IANA catalog, UTC/current/draft aliases and a custom IANA entry for names missing from the browser catalog. Backend remains the final validator. Design changes stay local in its existing demo hook and survive navigation.
- Only a confirmed timezone is merged into the live `ApiUser` projection/account and Calendar's future-create default. Calendar's controller is not recreated on timezone change, so pending submission IDs/payloads and loaded event zones remain intact. No existing event is converted or mutated.

## Backend handoff needed

When the owner provides the new PR/commit, inspect its code/tests/docs and implement the port through the **existing MroyaApi/session/CSRF transport** and live source. Verify:

1. Actual method/path, payload, response envelope, validation errors and availability behavior on older servers.
2. Server-side atomic only-if-unset semantics. A GET followed by an unconditional PATCH is not an acceptable substitute; a concurrent saved manual setting must win initialization.
3. Manual timezone normalization/aliases, whether empty values may be cleared, and exact confirmation behavior.
4. Confirmed user ID/timezone, normal 401/403 behavior and ambiguous-response reconciliation through `/me/`.
5. API-specific synthetic tests; run all checks below again. Remove the pending integration notice only when the real adapter is connected.

No auth/OAuth flow, Google Calendar Sync, Chat, Memory or Backend changes are needed for this handoff. Current synthetic tests exercise the shared authenticated-user DTO/port; they do not claim real registration or timezone HTTP interoperability.

## Checks / first server test after completion

Run TypeScript, boundaries, Production/Design builds, unchanged production bundle verifier and targeted timezone/profile/session/calendar tests. The frozen Studio Settings SSR baseline is separately known stale and is not rewritten here.

After Backend deployment and wiring/review of this draft:

1. Sign in with an existing saved timezone: confirm no auto-write and unchanged calendar events.
2. Use an account with empty timezone (including a newly Google-created account): confirm exactly one only-if-unset initialization and a confirmed `/me/` value. Test failed detection/network and manual Profile recovery.
3. Select an uncommon zone/custom valid alias. Confirm Saving → backend-confirmed Saved; reload and check persistence. Force a failed write and check draft/Retry, including a lost reply that actually committed.
4. Create HH:MM, All day and recurring events. Confirm the profile zone is used only for new exact events, no duplicate creates, and all events remain after reload.
5. Change profile timezone while a calendar request is pending: confirm that request keeps its original payload/submission and existing events retain their original timezone.

These are future owner checks, not actions performed on production. No account creation, real OAuth/provider request, production user mutation, merge or deployment was performed.
