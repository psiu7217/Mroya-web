# Timezone: browser initialization, Profile and Calendar

Contract checked against [Backend PR #30](https://github.com/psiu7217/Mroya-api/pull/30), HEAD `328906e3b2c3d67afbbef650697f1e854ce9f7a8`: API preferences view, UserPreferencesForm, ZoneInfo validator, API docs and timezone tests. Backend PR must be installed before live verification; this frontend PR does not merge/deploy it.

## Transport and state

Both operations use the existing `MroyaApi.savePreferences`, same-origin Django session and CSRF:

```json
{"timezone":"Europe/Sofia"}
```

```json
{"timezone":"Europe/Sofia","timezone_only_if_unset":true}
```

PATCH `/api/v1/me/preferences/` returns `200 {"user": ...}`. Manual writes must confirm the selected timezone. Initialization may return a different nonempty timezone that another request already saved; the frontend adopts that value. The only-if-unset check is atomic on Backend, never a client GET/unconditional PATCH substitute.

Timezone must be a nonempty IANA name, at most 128 characters, without surrounding whitespace. Backend/ZoneInfo is the final authority, including aliases/new names absent from the browser catalog. Empty/null/unknown values and invalid flags return `400 invalid_preferences` without partial writes. The flag requires timezone; false means manual update. This API cannot clear timezone. There is no new capability flag: older servers reject the new fields and show an error with the draft preserved; other preference fields remain independent.

`src/hooks/useUserTimezone.ts` owns account-scoped confirmed timezone, draft, one initialization attempt, serialized manual edits, error/retry and cleanup. The existing live source wires the two semantic operations to the existing preferences client; no second HTTP client/auth system is added.

- The first authenticated mount (password login, Google-created user or restored session) initializes an empty timezone from `Intl.DateTimeFormat().resolvedOptions().timeZone`. Saved timezone skips detection/writes. StrictMode abandoned setups do not send duplicate initialization.
- Initial retries retain only-if-unset semantics, including after a lost response. An explicit manual choice permits a manual save. A late initialization/session snapshot cannot erase a newer draft or a confirmed value.
- A failed write preserves draft and requires explicit Retry. Retry reads `/me/` through the existing session source, avoids replay if the write already committed, refreshes CSRF when needed and then saves the still-pending choice. Mismatched user/confirmation never produces Saved.
- Only confirmed timezone is merged into the live User projection/account and Calendar future-create default. The Calendar controller is not recreated on a timezone change, preserving pending submissions/payloads and loaded event timezones. No existing event is converted or mutated.
- Profile retains its existing dropdown/style, adds the full runtime-supported catalog plus UTC/current/draft aliases and a custom IANA entry. Saving/Saved/error/retry are explicit. Unknown names are rejected by Backend, not a limited hardcoded browser list. Design stays local in its existing demo hook and survives navigation.
- Failed detection or initialization presents a Profile action. Logout/account change aborts pending requests and ignores late replies. No timezone/draft/init flag is persisted in browser storage.

## Validation

Targeted tests cover the actual client/live-source request shape and synthetic responses for session/login, initialization, cross-client only-if-unset, manual racing with initialization, failed detection, lost reply/reconciliation, CSRF/errors, stale account responses, full catalog/custom input, Profile confirmation and Calendar HH:MM/all-day/recurrence/persistence/no duplicate creates. They do not perform real registration/OAuth or production writes.

TypeScript, boundaries, Production/Design builds and the unchanged production bundle verifier must pass. The known frozen Studio Settings SSR baseline is separately stale and is not rewritten here.

## First check on the working server (owner, after review/deployment)

1. Install Backend PR #30 first (no migrations per that PR), then the reviewed Frontend. Sign in with an existing saved timezone: expect no auto-write and unchanged events.
2. Use an account whose timezone is empty, including a newly Google-created account: verify one PATCH with `timezone_only_if_unset:true`, followed by a confirmed `/me/` value. Test failed detection/network and manual Profile recovery.
3. Select an uncommon zone/custom valid alias: expect Saving → backend-confirmed Saved. Reload to check persistence. Force an error and check draft/Retry, including a lost reply that actually committed.
4. Create HH:MM, All day and recurring events. Confirm the profile zone is used only for new exact events, no duplicate creates, and events persist after reload. With no timezone and failed setup, exact creation must fail clearly while All day remains possible.
5. Change profile timezone while a calendar write is pending: that request keeps its original payload/submission; existing events keep their original timezone. Check nickname/theme still save independently.

These are future owner checks, not actions performed on production. No real account creation, OAuth/provider request, production mutation, merge or deployment was performed.
