# Backend contract for Mroya Web

Mroya API is authoritative for identity, user data and business logic. This inventory was checked against Django routes/views, chat and memory services, and Google OAuth application code installed at `503f99c98c`. The canonical methods, payloads, DTOs, limits and errors are in [API.md](https://github.com/psiu7217/Mroya-api/blob/main/docs/API.md); OAuth setup and flow are in [GOOGLE-OAUTH.md](https://github.com/psiu7217/Mroya-api/blob/main/docs/GOOGLE-OAUTH.md). Read those references before adding a feature. Markdown alone does not establish API availability: verify current code and capabilities.

## Published routes

All paths below are relative to the fixed same-origin `/api/v1/` on app.heymroya.com.

| Method/path | Contract |
| --- | --- |
| GET auth/csrf/ | Public; csrf_token and CSRF cookie |
| POST auth/login/ | username/password JSON + X-CSRFToken; user and rotated csrf_token |
| POST auth/logout/ | Session + CSRF; status logged_out and rotated token |
| GET me/ | user (numeric id, username/email/names/timezone/nickname/preferences.theme/preferences.show_model_reasoning); 401 means guest |
| PATCH me/preferences/ | Authenticated CSRF JSON theme/nickname/show_model_reasoning; returns updated user; theme system/light/dark, nickname up to 80 or empty to clear |
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

The link is a one-use bearer credential, valid for 12 minutes. Re-generation invalidates the previous unused link. Connect/Generate new link/creation Retry synchronously reserve an about:blank tab and immediately clear its opener before any await (including CSRF). After validating HTTPS, exact t.me host, a bot/start URL and expiry, redirect only that still-controlled blank tab. Errors/cancellation/logout close only the temporary blank tab; late results cannot navigate it. A blocked/closed/inaccessible popup shows the explicit Open Telegram fallback anchor with noopener noreferrer and an explanation; normal success has no extra Open button. Never open tabs from GET or Design actions. Press Start in Telegram and return; focus/visibility refresh only the active Connections tab or an unfinished flow. There is no used/revoked-link lookup, polling or Telegram event stream. Expiry removes the URL but does not prove disconnection.

Transport and DTO validation stay in MroyaApi/createLiveSource. The account-local useTelegramConnection hook owns status, request cancellation/generation guards, single-flight operations, errors, expiry and a transient link in memory only. WorkspaceRuntime passes typed presentation/actions to the existing common card; it is not a persistent/global store. Logout/user changes invalidate requests and erase link/identity. No storage, console/telemetry, Mroya query parameter or displayed token text. Never call telegram/webhook/ from Web; Bot Token/webhook secret belong only to API.

Design retains local connection toggles with no requests or real bearer links. Telegram supports personal text chat, shared Web/Telegram history and personal memory. Telegram answers only Telegram messages: no Web forwarding, reminders/alerts, voice, attachments, calendar sync, groups or morning briefings. Google Calendar/Gmail remain Coming soon.

Manual acceptance after a separately authorized merge/deploy: an existing owner account creates a link, presses Start, verifies Connected on return and optionally Disconnect; verify shared text history/memory separately. This PR creates no production accounts or bindings and does not deploy either runtime.

## AI Error Reporting (repository contract, API 471f771)

Verified read-only against [AI diagnostics](https://github.com/psiu7217/Mroya-api/blob/a41fd3d0cdff92f84dc5ab28bc0ec5d41e0e7b78/docs/AI-DIAGNOSTICS.md), API routes/views and Chat reporting/error-reporting code. API PR #7 introduced reporting; API PR #11 adds full copy without migrations. Repository merge does not confirm either runtime deployment. No production errors or forensic records were accessed for this integration.

- Failed assistant history, failed Turn activity and SSE trace may provide report_context: {turn_id:UUID, request_trace_id:positive safe JS integer, report_url:exact /api/v1/chat/turns/{turn_id}/report/ path}. Invalid/missing context disables actions. Message ID and submission_id never substitute for turn_id.
- POST chat/turns/{turn_id}/report/ uses session + CSRF and exactly {request_trace_id}. HTTP 201 with created:true creates the issue; 200 with created:false replays it. Validate issue UUID, matching turn/trace, status new/investigating/resolved and created_at timestamp. Other success statuses, malformed JSON/DTOs and wrong MIME are errors.
- 400 invalid_json/invalid_report, 401 session expiry, 403 CSRF, 404 missing/foreign, 409 report_trace_mismatch/turn_not_failed, 503 report_temporarily_unavailable, plus standard 405/413. No automatic POST retry or retargeting. A manual click after 403 refreshes CSRF first. Network/503 retry uses the same captured pair. Diagnostics errors use the existing Workspace notice slot; they never start an Agent retry.
- GET chat/turns/{turn_id}/error/ is owner-bound text/plain, not forensic JSON/Admin. The client requires HTTP 200, validates MIME and bounds the stream to 16 KiB (the backend short report is <=2049 characters). A reused turn can point to a newer trace: before clipboard handoff verify the backend's ChatTurn: and RequestTrace: metadata lines match the captured pair. Copy the original server text unchanged; never construct local JSON, collect browser URL/user-agent/messages, or fetch private Admin data. 404 after successful Retry has no substitute report.

The existing ChatWorkspace buttons/layout/classes/icons/text remain Studio-owned. Shared typed diagnostics presentation/actions pass through WorkspaceModel/WorkspaceRuntime and WorkspaceView. Live state is account-local in useChatDiagnostics and keyed by turn_id + request_trace_id. History adapters validate and preserve the context; current failed SSE/Turn recovery can retain it while canonical history is unavailable. A late response updates only its original attempt, and logout/session expiry/account change abort and invalidate pending work. Only successful report POST shows Report sent. No reported-status GET exists: reload starts unconfirmed. Confirmation flags live only in current session memory, never persistent storage. Studio's isAdmin display hint is not an authorization claim; only Backend permissions authorize full reports.

Clipboard: invoke navigator.clipboard.write synchronously in the click stack with a ClipboardItem whose text/plain value is a Promise<Blob>. Resolve only the validated server report. This avoids awaiting fetch before the native write request. See [WebKit user gesture rules / promised data](https://webkit.org/blog/10855/async-clipboard-api/) and [ClipboardItem constructor](https://developer.mozilla.org/en-US/docs/Web/API/ClipboardItem/ClipboardItem). If write/ClipboardItem is absent, use writeText after fetching; activation/permission policy can still reject it. No automatic fallback after a native denial, retry loop, hidden textarea or execCommand is added for diagnostics. Diagnostics copied! appears only after the native operation resolves and clears using the original temporary copied state. Cancellation before Blob handoff prevents old-session text delivery; the browser provides no way to revoke a native clipboard write after it has already consumed the data. Late completion still cannot set state for another account.

Design uses local demonstration state and a constant synthetic preview report through the same clipboard helper; no backend/real account/context is used. Production has no demo success or local JSON substitute. All API, clipboard, concurrency and visual tests use synthetic/mocked data. Chromium (Codex in-app browser) was checked with native promised Clipboard write and a real paste of the exact synthetic server text into the existing composer, without sending it. Permission rejection, report failure/manual retry, reload, desktop/mobile 390px and Light/Dark were also checked. Firefox/Safari/iOS activation and native clipboard policy still require manual verification. Owner-bound production acceptance requires separately confirmed backend deployment/migrations and approved frontend publication; no real error investigation is authorized.

### Full Copy (API PR #11)

Verified against [canonical report renderer](https://github.com/psiu7217/Mroya-api/blob/471f771dfd2849c40df8bf87c6fad4c397ac9a43/apps/agent/failure_diagnostics.py) and [full endpoint contract](https://github.com/psiu7217/Mroya-api/blob/471f771dfd2849c40df8bf87c6fad4c397ac9a43/docs/API.md#full-diagnostic-text-authorized-owner-only).
The existing Copy callback first GETs chat/turns/{turn_id}/error/full/ using the
same session, no CSRF or additional identifiers. Active staff ownership plus
agent.view_failurediagnostic (or superuser) and an unexpired current failed
diagnostic are checked by Django. HTTP 200 is the exact text/plain render_report()
used by Admin Download report, with server redaction.

Only 403 with code forbidden triggers one short /error/ GET; this expected
permission denial does not mark CSRF stale. All other errors, including 401,
404, other 403 codes, 5xx, bad MIME/UTF-8, size/stream errors and invalid Metadata
fail without fallback. No automatic retries or frontend role inference.
The shared streaming reader requires 200/text/plain and counts actual bytes:
full <=8 MiB, short <=16 KiB, including untrusted/missing Content-Length.
Fatal streaming UTF-8 decoding preserves split characters; no partial report
is returned. Cancellation and account generation guards apply to both reads.

Before returning the unchanged full text to the existing promised ClipboardItem,
require BEGIN/END MROYA ERROR REPORT markers and the first canonical ## Metadata
section, decode its matching backtick-fenced JSON (the renderer lengthens fences),
and compare chat_turn_id plus numeric trace_id with the immutable clicked
report_context. Never find IDs inside user/provider text or retarget a reused turn.
No payload enters persistent state/storage/logging; only transient clipboard
loading memory. Native clipboard success remains the sole Copied confirmation.
Design, Report issue and all Studio JSX/styles/text remain unchanged.

Release gate: on 2026-10-15 an unauthenticated synthetic-UUID probe of the public
same-origin full path returned 404 not_found, whereas the short path requires
a session. Full endpoint deployment is not confirmed; a missing route must not
silently fall back. Confirm API PR #11 deployment before publishing this frontend.
No real forensic data was read and no deployment was run for this change.


## Model reasoning (API PRs #12–14, main e4a5755)

Verified against [API.md](https://github.com/psiu7217/Mroya-api/blob/e4a5755a16029552b63ba00114b60c5c7530c648/docs/API.md)
and [AGENT-STREAMING.md](https://github.com/psiu7217/Mroya-api/blob/e4a5755a16029552b63ba00114b60c5c7530c648/docs/AGENT-STREAMING.md).
me/login/PATCH return user.preferences.show_model_reasoning (boolean, default false).
PATCH accepts actual booleans including false, alongside independent theme/nickname
fields. The existing serialized preference queue, error/unsaved/retry, CSRF/session
handling and account invalidation apply. Older responses lacking the field read as
false for compatibility; a PATCH of this field requires an explicit matching boolean
response before confirming success. No localStorage or Chat request flag is added.

The existing Studio checkbox receives controlled props only in LiveExperience /
WorkspaceView; Design retains the component's local demonstration behavior.
No changes to components, ModelReasoningBlock, preview, classes, styles or layout.

SSE accepts reasoning_delta {turn_number,sequence,text} and tool_activity
{sequence,activity:{kind,status,title}}. Positive integer sequence strictly increases
across both event types; provider turn_number is positive and nondecreasing.
Malformed JSON/DTO/order/UTF-8, error or EOF without done reject the stream.
tool_activity is rendered through the Tool Activity timeline below and never used to invent reasoning.

Reasoning deltas create the current transient assistant reply before answer delta.
The shared adapter passes real streamed text to existing ChatMessage.reasoning /
ModelReasoningBlock. It remains in memory only, scoped to the current controller.
After completion/history refresh, retain text only on an unambiguous newly returned
adjacent canonical user/assistant pair matching the submitted question and accepted
answer, excluding all pre-submission message IDs. The API does not expose submission
or turn IDs on successful history messages; ambiguous matching deliberately drops
reasoning rather than assigning it to another message. Once bound, subsequent history
updates use canonical message IDs, never array positions or final-answer-only matches.
Failures/interruption clear provisional reasoning and streaming state; logout,
account/controller replacement and page reload discard all transient reasoning.
No reasoning is sent back to Backend or recovered from history/replay.

Visible reasoning requires BOTH the server streaming flag and this saved preference,
latched when the request is reserved. Changes affect new requests. No readable
reasoning is a valid normal answer (no extra AI request/fabricated fallback).
Failed streaming submissions cannot be automatically replayed, even with retry:true;
use existing owned turn/history recovery. Deployment of the flag and preference
migration identity.0004_user_show_model_reasoning is a separate Backend concern.
This frontend PR does not deploy or perform paid/provider calls.


## Live Tool Activity (API main f759501)

Verified read-only against [the published contract](https://github.com/psiu7217/Mroya-api/blob/f75950126ece0ce760c14ec0e7f2e94cf4f88e33/docs/AGENT-STREAMING.md)
and apps/agent/live_tool_activity.py, Agent loop and Chat services at that commit.
Backend PR #18 is merged; this frontend change does not deploy or call a Provider.

### Wire contract and validation

The existing SSE event remains tool_activity {sequence,activity}. Legacy activity
is exactly {kind,status,title}, with success/failure/neutral, and creates one
completed local entry per real sequence. It never fabricates a server call_id.

Expanded activity has exactly call_id, tool_name, turn_number, phase, status,
kind, title, input, output, duration_ms and truncated. call_id is
t<positive Provider turn>-c<positive call position>, consistent with turn_number,
request-local and unrelated to native Provider IDs. Known tool_name/kind pairs
are checked against the Backend implementation.

- started: status running, allowlisted input or null, output/duration_ms null.
- finished executed: success/failure, input null, nonnegative integer duration_ms.
- finished/not_executed: input/duration_ms null; may arrive without started.
- Mixed/partial forms, extra fields, malformed IDs, unexpected statuses,
  duplicate/backward sequence, mismatched or repeated call transitions and unknown
  executed finished are rejected. not_executed without started is explicitly valid.
  A started call cannot resolve through a preflight not_executed; it must finish
  execution or become locally uncertain.
- reasoning/tool events retain the shared increasing sequence. Started calls
  advance Provider turn order; finishing a known card retains its original position.
  Done with unresolved started calls is invalid; error/EOF never becomes success.
  Existing 2 MiB UTF-8 SSE-frame bounds and terminal/JSON/UTF-8 handling remain.

The API helper validates exact nested allowlists before any detail is serialized
for UI. Search/prepare queries and facts, expanded entities/directions/facts,
proposed write/revision facts, write/reuse/revision/forget result counts/actions/
search_ready, resolve reason/missing_dimension and decision flags follow the
canonical table. Failure exposes only tool_execution_failed (or null);
not_executed uses only the documented error-code enum (or null).
Calendar, echo, generic tools and forget input have no invented detail schemas.
Unknown/provenance/provider/header/secret fields are rejected, never displayed.

Preview limits: <=4 items per collection, <=240 Unicode code points per display
string, detail depth <=6, and <=8192 ASCII-normalized serialized activity bytes
using default JSON separators, excluding the SSE envelope. Counts can exceed
preview lengths. Null projections are valid: sanitization/projection failure may
omit any detail. Backend owns privacy/redaction; Frontend is not a substitute for it.

### Request-local state and UI

The existing controller/lifecycle guards own the timeline. A real started creates
one running entry keyed by call_id within that send. Finished updates that entry
in place, retaining input and chronological position while applying the exact
Backend title/status/output/duration. Distinct IDs remain distinct even for the
same tool name. Standalone not_executed creates one Not executed card without
Running/duration. Legacy and expanded events can coexist without merging by name.

The existing ToolActivityBlock and ChatActivityTimeline are reused; no redesign
or new component. Only the existing description/input/output/duration/status slots
receive validated fields. Title remains server text. Some details are shortened
or unavailable is a neutral truncation/omission notice, including when both
projections are null; missing Input/Output shows Data unavailable without Copy.
JSON is React text, with the existing bounded wrapping/scrolling, available-data
Copy and native resolve-only Copied protection. No changes to ModelReasoningBlock,
layout, classes, preview, navigation, auth or settings.

Proposed input is not proof of persistence. Memory change not confirmed/failure
stays Failed even if the Agent subsequently produces an accepted answer.
prepare/resolve/reused_existing do not imply new memory creation. search_ready
false/null does not undo a canonical write and is displayed without reinterpretation.

Interruption or Chat failure replaces still-running local entries with Interrupted,
removes provisional reasoning and stops animation. This does not assert executor
entry, success, failure or rollback; started precedes actual executor entry.
Confirmed finished outcomes retain their server status. Canonical failed-message
retention includes only confirmed finished/legacy outcomes, using the existing
exact turn_id/request_trace_id guard. Local interrupted/provisional entries are
not persisted onto failed history. Successful canonical association remains
PR #18/#19's cautious new question/answer pair match, then canonical message IDs.
Ambiguity drops transient data. Recover/submission/retry semantics and API requests
are unchanged: never automatically re-run Agent after disconnection.

Timeline/projections remain in controller memory only. Logout/account disposal
clears them; old callbacks cannot affect a new send/account. Reload can remove
them. No localStorage, sessionStorage, IndexedDB, logs, analytics, history writes,
extra endpoints, parameters or paid calls. Design stays offline with the same UI.

Readiness here means tested frontend implementation against the merged Backend
repository contract. Production flag/deployment and actual provider/account
acceptance are separate owner-authorized checks.
