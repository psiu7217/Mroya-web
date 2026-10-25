# Stage 2 — AI Memory Review dry run

Requires matching Backend `memory-review-v1` API and additive migration
`intelligence.0010_memoryreviewjob_and_more`. See the Backend
[contract](https://github.com/psiu7217/Mroya-api/blob/codex/memory-review-dry-run/docs/MEMORY-REVIEW-DRY-RUN.md).
Do not release Frontend functionality before that Backend is available. Missing
routes produce an explicit unavailable state, never demo/success data.

Memory Inbox → History/status tab → Initial Filter → **YES** exposes
“Send N events for deep AI review”. N comes from Backend eligible_count (current,
owned, consented APPROVE only), not the paginated initial-results list or an
approximate old approval count. The Backend enqueues all eligible approved events;
the browser cannot submit arbitrary texts/event IDs. Repeated clicks cannot create
new work for the same revision. Zero eligible/disabled/unconfigured/loading/busy
states disable the action.

The independent **Deep AI review** section renders actual job statuses, heartbeat
availability, global counters and paginated results. KEEP reveals 1–8 draft cards;
DISCARD and NEEDS_CLARIFICATION have no proposals. Every draft shows formulation,
type, intended structure, possible local entities/relations, usefulness, quoted
source evidence and uncertainty. It is explicitly not a verified canonical memory.
There is no Save/Accept/write action. Details are selectable read-only text.
Error jobs offer an explicit retry (bounded server-side). Stale jobs cannot be
retried as if current. No Frontend call can enter legacy Deep Analysis/Safe Apply.

Transport reuses MroyaApi session + CSRF and WorkspaceSource, with validated bounded
DTOs. POST queue/retry bodies are exactly `{}`. Reads use limit=20/offset. Polling is
5 seconds after a completed request, only while pending/processing AND enabled AND
worker heartbeat is current. Stopped/disabled/error states require explicit refresh;
there is no automatic replay of mutations. Initial Filter refresh also updates the
eligible count. Leaving the history tab/page, logout, account switch and expiry
abort requests, cancel timers and erase review state/receipts. Late responses cannot
restore another account's results. Design Mode makes no stage-2 API calls and gains
no Production fallback fixtures. Components receive typed presentation props only.

All new labels use existing RU/EN i18n; visual structure uses Mroya theme variables,
wrapping, disclosure cards and mobile-friendly flex layouts. No dependencies,
design-mode switches, auth architecture, Google sync or existing Inbox mutations
change in this PR.

## First safe run after explicit release approval

1. Install reviewed Backend migration and Frontend; configure a Chat model for
   review with conservative output/batch limits, enable review, run existing worker.
2. Use a synthetic calendar with explicit consent and completed Initial Filter
   APPROVE results. Do not use real personal data for first model verification.
3. Open YES and enqueue. Watch pending → processing → completed/error; inspect
   actual ProviderCall usage/cost in Backend Admin and 0–N draft cards.
4. Verify no real Memory Inbox proposal, Neo4j read/write or Save action occurs.
5. Disable review_enabled to stop future processing. No paid requests, production
   configuration changes, merge or deployment were performed by these PRs.

Limits: model semantic accuracy needs an explicitly authorized real model test;
identity matching/deduplication against memory is deliberately impossible here.
Browser authenticated acceptance on the real server remains owner-controlled.

## Verification on Ubuntu (2026-10-25)

Final full suite: **442 passed**. Focused review/initial-filter suite: **14 passed**.
TypeScript, UI/data boundary checks, Production build, Production fixture-isolation
check and Design build pass. Production-mode SSR tests render real supplied DTOs in
RU/EN, escape event HTML and prohibit Save/Accept actions. Build retains existing
large-chunk and Memory Map dynamic-import warnings. A real authenticated browser
session, visual desktop/mobile Light/Dark inspection and a paid model call have not
been performed; theme/adaptive classes are preserved, but SSR is not pixel QA.
