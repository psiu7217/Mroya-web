# Outbound Telegram notifications: Studio handoff

Functional layer only; this PR adds no visual controls and changes no Studio JSX,
classes or styles. Backend dependency: [Mroya-api PR #35](https://github.com/psiu7217/Mroya-api/pull/35),
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

A future Studio task may pass this object to the existing shared Connections
component and create the agreed visuals there. Do not fetch or implement auth,
connection management, retries, idempotency or status inference in that component.
Do not call onSendTest from effects. Do not locally set Saved or Delivered.
The object is not yet consumed by visual components in this functional-only PR.

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
is disabled. Studio can select another initial scenario in the Design hook without
new controls. All are local simulations, excluded from Production. There is no
network, persisted notification state or real test sending from Design Mode.

Before manual live review: Backend PR #35 must be reviewed/merged/deployed with
its additive migration, feature flag and worker activated separately according to
its contract. Test only with an explicitly consenting operator: confirm GET,
opt-in PATCH, click Send test once, then Refresh until confirmed terminal status.
Check disconnect/reconnect, disabled/unconfigured/worker-unavailable, and explicit
error Retry. This frontend PR performs no activation, merge or deployment.
