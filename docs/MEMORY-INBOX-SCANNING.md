# Live Inbox scanning

Requires the Backend scans API and additive intelligence.0004 migration; restart
its existing worker to publish heartbeat. No production deployment performed by this PR.
See Backend docs/MEMORY-INTELLIGENCE-SCANNING.md for the authoritative contract.

Above Inbox cards, Scanning shows owned calendars, existing consent, latest sweep,
real counters and quota/structural errors. Only already-enabled calendars can be
selected (up to 50 per request). Selection is controller memory, not source consent.
POST /api/v1/memory-intelligence/scans/ uses the existing session/CSRF client;
202 only acknowledges a request. Active selected passes disable duplicate clicks.
The Backend additionally deduplicates and enforces cooldown. Pagination loads more
calendars explicitly. No Google/unknown-origin resources are enabled by the Web.

A progress bar appears only after discovery yields a known denominator. Completed
means processing settled, not proposals accepted or memory saved. Empty Inbox says
“Предложений пока нет”. Heartbeat unavailable is explicitly a stale/no heartbeat
observation, not a Docker status inference. Quota/error/disabled states are visible.

Polling includes the first proposals page even if initially empty, plus rotating
batches of up to ten loaded processing cards and loaded calendar pages. It runs
one round at a time every five seconds, up to twelve rounds per refresh/visibility
session. On exhaustion a pause notice offers manual refresh; no unbounded retries.
Leaving Memory, tab hiding, logout or identity/controller replacement aborts work
and rejects late responses. Re-entering resumes a bounded session. Interrupted
writes retain their original idempotency operation for explicit retry.

Presentation components only consume typed props/actions; same shared UI for
Light/Dark/mobile and Design Mode. No fake production cards or successful scans.
