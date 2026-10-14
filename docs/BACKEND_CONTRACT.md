# Backend contract for Mroya Web

Mroya API is authoritative for identity, user data and business logic. This inventory was checked against Django routes/views, chat and memory services, and Google OAuth application code installed at `503f99c98c`. The canonical methods, payloads, DTOs, limits and errors are in [API.md](https://github.com/psiu7217/Mroya-api/blob/main/docs/API.md); OAuth setup and flow are in [GOOGLE-OAUTH.md](https://github.com/psiu7217/Mroya-api/blob/main/docs/GOOGLE-OAUTH.md). Read those references before adding a feature. Markdown alone does not establish API availability: verify current code and capabilities.

## Published routes

All paths below are relative to the fixed same-origin `/api/v1/` on app.heymroya.com.

| Method/path | Contract |
| --- | --- |
| GET auth/csrf/ | Public; csrf_token and CSRF cookie |
| POST auth/login/ | username/password JSON + X-CSRFToken; user and rotated csrf_token |
| POST auth/logout/ | Session + CSRF; status logged_out and rotated token |
| GET me/ | user (numeric id, username/email/names/timezone/nickname/preferences.theme); 401 means guest |
| PATCH me/preferences/ | Authenticated CSRF JSON theme/nickname; returns updated user; theme system/light/dark, nickname up to 80 or empty to clear |
| POST auth/google/start/ | CSRF-protected ordinary HTML form; 302 to Google |
| GET auth/google/callback/ | Google's code/state; verified Django session then redirect to Web |
| GET chat/messages/ | limit 1..200/default50, before sequence; conversation_id, messages, next_before |
| POST chat/send/ | content 1..16000, submission_id UUID, optional IANA timezone/boolean retry; SSE or completed JSON replay |
| GET chat/turns/{UUID}/ | Owned turn: activity, turn_status and result/error fields |
| GET chat/turns/{UUID}/error/ | Failed owned turn only; bounded text/plain report |
| GET memories/ | state active/history/all, q<=160, offset<=100000, limit default25; memories and total |
| GET memories/{UUID}/ | Detailed memory/provenance in memory; owner-only |
| GET memories/map/ | Canonical nodes/edges, truncated, optional stats |
| GET capabilities/ | Public effective capabilities, including google_oauth |

For memories use limit<=50: the adapter accepts <=100 but its repository currently accepts <=50. History returns chronological pages; next_before is present only if an older page exists. Dates are server timestamps; preserve canonical UUIDs, validity and provenance when mapping DTOs into presentation props. The graph can be truncated; do not silently represent it as complete.

## Existing frontend integration

Use `src/api/client.ts`, `errors.ts`, `sse.ts` and the existing hooks/providers. Do not create another HTTP client or authentication system. UI receives typed actions/state through `src/types/workspace.ts`; do not fetch, read cookies/storage or import demo fixtures from presentation components.

The client uses same-origin cookies and no-store. Django owns host-only Secure, HttpOnly session cookies; the browser does not store secrets/tokens in localStorage. Get CSRF before writes and refresh on session rotation. An ordinary OAuth form uses csrfmiddlewaretoken instead of the JSON client's header. Keep auth/CSRF transport in the existing API layer.

JSON errors normally contain error.code/error.message; message can be absent on disabled OAuth. Account bootstrap treats only me/401 as guest. Network/5xx failures remain errors with retry. Never inject demo records on live failures. Handle status and Content-Type, including non-JSON proxy errors, OAuth redirects and text reports. Do not automatically repeat a CSRF-rejected write.

Chat SSE is fetch POST, not EventSource. Parse trace/delta/done/error across chunk boundaries; delta is the full answer, since sse_token_streaming=false. Capture X-Chat-Turn-ID early and retain submission_id. EOF without done is interrupted; inspect the original turn and authoritative history before resending. Completed duplicates replay JSON, running/failed/conflicting submissions return 409. A failed retry uses the same UUID/content and retry:true, never an automatic new submission. Stale recovery occurs server-side after ten minutes.

## Google Sign-In: same-origin integration

The Web guest/login state reads the public google_oauth capability. The existing API client rechecks that it is explicitly true, obtains fresh CSRF, and submits the ordinary same-origin form. Its csrf method now returns the token for that form while retaining it in client memory for JSON writes. Password login remains available; no second fetch/auth implementation is used. Design Mode simulates the Google action locally.

Submit an ordinary same-origin POST form to auth/google/start/; do not fetch-follow Google's redirect and do not add a browser Google SDK/JWT. The exact registered callback is https://app.heymroya.com/api/v1/auth/google/callback/. Client secret remains on API only. After return, me/ establishes the UI identity and fresh CSRF supports later writes. Display only the documented auth_error allowlist. Return notices survive initial session loading and retry; guests see the login dialog, and an already authenticated session sees a dismissible notice. Unknown codes are ignored and the parameter is removed without discarding other query parameters/hash. Google signup requires verified email. The current API can link a unique matching ordinary account; staff/superuser linking requires authenticated Google Connect. Password signup is not published; newly created Google accounts have no usable password. See the canonical API OAuth reference for the current connect/session rules.

## Capabilities and boundaries

Available: chat, memory_read, memory_mutations_via_chat. google_oauth is configuration-dependent (currently true on the published API). Unavailable: memory_mutations_rest, calendar_rest, connections_rest, reminders, local_recurrence, sse_token_streaming. Missing/unknown flags mean unsupported.

Authenticated Google Connect is published by the API; a Connect UI is outside this preferences PR. There are no public subscription, password signup, attachment/voice upload, chat cancellation or conversation CRUD endpoints. Existing internal modules and design screens do not establish those contracts. If a required route is absent, report the necessary API work; never invent a URL or pass local simulated state off as persisted data.

Design Mode remains a separate offline build with fictional data/accounts. Production cannot be switched into Design Mode through query strings, storage or a user control. Preserve all visual screens and responsive layout; live unavailable features remain explicitly unavailable. See [AI Studio workflow](AI_STUDIO_WORKFLOW.md) and [guest/live behavior](GUEST_CHAT.md).

Theme and nickname are persistent account preferences; the frontend uses the existing session/CSRF client and serializes PATCH operations. Guest theme remains separate in browser storage. The backend's published `me/preferences/` contract must be deployed with migration `identity.0003_user_preferences` before functional testing. Read `docs/API.md` in Mroya-api for 400 `invalid_preferences` validation fields.

Positive login with real credentials requires the owner's manual browser check when credentials are not supplied. Do not create production test users or modify real user data for a release smoke check.

Preference-save failures retain the latest submitted choices as unsaved until explicit retry. Ambiguous network/5xx failures are reconciled with me/ before another PATCH; edits and retries share one queue. No account preferences are persisted in localStorage. Abort/expiry/logout invalidate pending work. Production route presence was confirmed read-only (GET returns 405 with Allow: PATCH); authenticated persistence and migration readiness still require an owner browser check before release.

## Telegram connection (verified API main 78011891e694e0612c3af09881452f5f1fd77a69)

Verified against [session linking views](https://github.com/psiu7217/Mroya-api/blob/78011891e694e0612c3af09881452f5f1fd77a69/apps/telegram_channel/views.py) and [Telegram contract](https://github.com/psiu7217/Mroya-api/blob/78011891e694e0612c3af09881452f5f1fd77a69/docs/TELEGRAM.md). This specific published contract is independent of the broad connections_rest flag; it does not make Calendar/Gmail connections available.

| Same-origin method/path | Request and successful response |
| --- | --- |
| GET me/telegram/ | Session, no CSRF. {configured:boolean, connected:boolean, bot_username:string}; a binding adds telegram_username:string and connected_at:ISO timestamp. |
| POST me/telegram/link/ | Session + CSRF, exact JSON {}. {url:string, expires_at:ISO timestamp}. |
| DELETE me/telegram/ | Session + CSRF. {connected:false}; idempotent and revokes unused links. |

configured and connected are independent: a binding survives configuration failure. Only GET confirms Connected/Disconnected; POST merely issues a link, DELETE is followed by authoritative GET. Unconfigured/disconnected is temporarily unavailable. Errors use the existing envelope: 401 expires the session, 403 requires explicit retry with refreshed CSRF, 409 already_linked rechecks GET (link_replaced is also possible), 503 shows retryable unavailability. Never automatically replay writes; an ambiguous DELETE is reconciled through GET before manual retry. An ambiguous POST must not automatically replace a possibly issued token.

The link is a one-use bearer credential, valid for 12 minutes. Re-generation invalidates the previous unused link. Validate HTTPS, exact t.me host and a bot/start URL before presenting an explicit Open Telegram anchor with noopener noreferrer. Press Start in Telegram, return and Check connection; focus/visibility refresh only the active Connections tab or an unfinished flow. There is no used/revoked-link lookup, polling or Telegram event stream. Expiry removes the URL but does not prove disconnection.

Transport and DTO validation stay in MroyaApi/createLiveSource. The account-local useTelegramConnection hook owns status, request cancellation/generation guards, single-flight operations, errors, expiry and a transient link in memory only. WorkspaceRuntime passes typed presentation/actions to the existing common card; it is not a persistent/global store. Logout/user changes invalidate requests and erase link/identity. No storage, console/telemetry, Mroya query parameter or displayed token text. Never call telegram/webhook/ from Web; Bot Token/webhook secret belong only to API.

Design retains local connection toggles with no requests or real bearer links. Telegram supports personal text chat, shared Web/Telegram history and personal memory. Telegram answers only Telegram messages: no Web forwarding, reminders/alerts, voice, attachments, calendar sync, groups or morning briefings. Google Calendar/Gmail remain Coming soon.

Manual acceptance after a separately authorized merge/deploy: an existing owner account creates a link, presses Start, verifies Connected on return and optionally Disconnect; verify shared text history/memory separately. This PR creates no production accounts or bindings and does not deploy either runtime.
