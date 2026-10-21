# Outbound Telegram notifications: Studio handoff

The shared Studio notification controls (visual commit `654a3176`) now use the
existing functional layer. Layout, classes and styling are preserved; only props,
action wiring, truthfully derived labels and disabled states are integrated. Backend dependency: [Mroya-api PR #35](https://github.com/psiu7217/Mroya-api/pull/35),
verified against routes, views, services and [contract at f1ec72e4](https://github.com/psiu7217/Mroya-api/blob/f1ec72e4a7f386b499c1f58b6d2bb619f7f9326c/docs/NOTIFICATIONS.md).
Backend main b876c467 does not yet include these routes. Source availability does
not confirm deployment, migration, feature enablement or a running worker.
No delivery was tested against production.

## Transport and actual DTOs

Existing MroyaApi / WorkspaceSource methods (fixed same-origin `/api/v1/`, Django
session, no-store; existing CSRF for writes):

| Method | Backend route | Body / response |
| --- | --- | --- |
| notificationSettings(signal?) | GET me/notifications/settings/ | NotificationSettings |
| saveNotificationSettings(enabled, signal?) | PATCH me/notifications/settings/ | `{telegram_enabled:boolean}` -> NotificationSettings |
| testNotification(requestId, signal?) | POST me/notifications/test/ | `{request_id:UUID}` -> exactly HTTP 202 NotificationDto |
| notification(id, signal?) | GET me/notifications/{UUID}/ | NotificationDto for the same ID |

Types live in `src/types/api.ts`; validated, whitelisted copies in
`src/api/notifications.ts`. Settings are `{channels:{telegram:{enabled,connected,
configured,delivery_ready}}}` (all booleans). Test DTO contains notification_id,
kind=system.test, timestamps and one Telegram delivery (status, attempts,
next_attempt_at, sent_at, error_code, parts_sent). No arbitrary recipient/text,
Bot Token, chat_id or link credential is sent or exposed by this integration.

Actual statuses: `pending`, `processing`, `retry`, `sent`, `failed`, `cancelled`,
`expired`. Suggested labels: Queued, Processing, Retrying, Delivered, Failed,
Cancelled, Expired. Only `sent` confirms acknowledgement of all parts by Telegram;
HTTP 202 never means delivered or read by the user. Disabling cancels active
Backend deliveries; re-enabling does not revive the cancelled backlog. An already
in-flight Telegram request cannot be recalled. delivery_ready is Backend
configuration/opt-in/binding/fresh worker-heartbeat evidence, not a delivery SLA.

401 clears state and expires session. 403 requires explicit Retry and fresh CSRF
before another write. 404 marks unavailable on an older server. 409, 429, 503 are
errors, never simulated success. No automatic mutation retry. Uncertain PATCH is
reconciled with GET, adopting the actual persisted setting. If GET cannot confirm
it, explicit Retry reads first before considering the original write again.

## Shared Workspace props for AI Studio

`WorkspaceView` already receives `model.notifications` in both modes; Production
also exposes the same object as `model.runtime.notifications`. The canonical
`NotificationPresentation` type is in `src/types/workspace.ts`:

- available, loading, saving, testing, error;
- enabled (confirmed opt-in), connected, configured, deliveryReady;
- canEnable, canSendTest (do not offer sending when false);
- lastTest / lastTestStatus (actual Backend status union);
- simulated (true only in Design; visibly label future delivery previews as simulations);
- onToggleTelegram(boolean), onSendTest(), onRefresh(), onRetry(): Promise<void>.

WorkspaceView passes model.notifications to the existing ConnectionsSettingsView.
The checkbox is controlled by confirmed enabled, and uses onToggleTelegram. Test,
Refresh and Retry use the corresponding controller actions. Conflicting operations
are disabled; disconnected Telegram cannot enable/send, but can disable a saved
opt-in. The notification section stays visible independently of Telegram binding.
No local toggle, delivery state or fake timer is authoritative. Errors render
separately; error Retry may re-read an unavailable server so it can recover.
Only a confirmed lastTest with status sent renders Delivered to Telegram (not read).
No queue count is inferred. A missing receipt does not become a failed/delivered test.
Do not fetch or implement auth, connection management, UUID generation, retries or
status inference from timers in the visual component.

onSendTest is an explicit user action. Rapid clicks are single-flight. While the
current test is nonterminal, this action only reads status. Transport retry of a
test keeps the original UUID (including lost responses); onRetry does not invent
a new send. After a confirmed terminal receipt a new explicit onSendTest starts a
new test. Retrying status reads/remounts never creates a test. onRefresh reads
settings and the current receipt; this PR adds no notification polling/timers or
focus writes. A failed delivery is not automatically resubmitted.

The account-local useNotificationSettings controller aborts/fences late responses,
clears receipts/idempotency keys on logout/source/user change and keeps everything
in memory. It receives the existing useTelegramConnection status/phase, including
immediate disconnect gating. Unlink does not fabricate enabled=false; reconnect
re-reads settings. It does not create Telegram links or manage a second binding.

## Offline preparation and first live review

Design fixture scenarios in `src/demo/notifications.ts`: disconnected, disabled,
enabled, queued, delivered, failed, unavailable. demoNotifications(scenario,
telegramConnected, setScenario) returns the same presentation contract. The demo
Workspace connects it to the existing local Telegram connection; preview default
is disabled. The existing Studio scenario toolbar uses notificationPreview props and the same
local demo controller; there is no competing state machine inside Settings. The
existing Loading preview is supported alongside the delivery scenarios. All are local simulations, excluded from Production. There is no
network, persisted notification state or real test sending from Design Mode.

Before manual live review: Backend PR #35 must be reviewed/merged/deployed with
its additive migration, feature flag and worker activated separately according to
its contract. Test only with an explicitly consenting operator: confirm GET,
opt-in PATCH, click Send test once, then Refresh until confirmed terminal status.
Check disconnect/reconnect, disabled/unconfigured/worker-unavailable, and explicit
error Retry. This frontend PR performs no activation, merge or deployment.


## Full Studio UI in Production: Preview / Soon

The owner's revised policy preserves the full Studio interface in Production.
Shared src/components/IntelligencePreviews.tsx renders event-analysis, entities,
proposal/conflict illustrations, autonomy and calendar-analysis permissions with
original Studio classes/layout. Production uses explicit Preview / Пример / Soon
labels, disabled inputs/buttons and no mutation handlers or fictitious save states.
Calendar's previous name-based analyzed badge now says AI analysis · Soon in live.

The public event illustration receives no real event, memory or Inbox proposal.
Its example person/company/place are independent of the opened event. No example
links to a real memory/proposal, and no real Memory operation is callable from it.
The src/demo adapter keeps interactive Design examples offline using the very same
visual components; account fixtures, demo IDs and Design runtime remain excluded
from the Production bundle. The unchanged production verifier still rejects private
fixture markers; targeted checks also require the public Preview components to be
present, so hiding them cannot accidentally satisfy isolation tests.

Existing Calendar CRUD, Google Sync, Memory Inbox decisions and Telegram connection
are untouched. Notification controls retain the existing real controller; absent
notification API shows Soon with disabled mutation controls, never fake delivery.
Errors still use explicit Retry. Backend PR #35 remains a separate live prerequisite.

Backend autonomy is review_all / auto_link / auto_write. Studio manual / auto_save
are not mapped to policy changes; the card is Soon until that mapping is agreed.
Static Work/Personal/Holidays examples cannot identify owner-scoped UserCalendars,
so their permission controls remain inert Soon illustrations, not persisted settings.
