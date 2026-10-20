# Memory Inbox integration

Single UI: `MemoryView` <- `WorkspaceView` <- `WorkspaceModel.memoryInbox`.
Design uses `useDemoMemoryInbox`; Production uses `useLiveMemoryInbox` and the
existing `MroyaApi` / `createLiveSource`. No shared UI imports demo, transport or
storage. This change does not deploy either runtime or enable Backend workers.

## HTTP mapping

All paths are same-origin `/api/v1/memory-intelligence/`, session-authenticated,
no-store JSON; POST reuses the existing CSRF handling. These are the actual routes,
not jobs endpoints used to imitate proposals.

| Method/path | Request | Response used |
| --- | --- | --- |
| GET settings/ | none | capabilities.inbox/deep_analysis/memory_apply/auto_link/auto_write/related_sources/stage |
| GET status/ | none | worker_enabled, deep_enabled, apply_enabled; job counts are not proposal state |
| GET proposals/ | limit=50, offset | proposals, next_offset; updated_at DESC / UUID DESC |
| GET proposals/{UUID}/ | none | proposal |
| GET proposals/{UUID}/history/ | limit=50, offset | history, next_offset; descending version |
| POST proposals/{UUID}/accept/ | version, request_id | proposal, replayed; normally pending_apply |
| POST proposals/{UUID}/reject/ | same | rejected card |
| POST proposals/{UUID}/comment/ | same plus comment | reanalyzing card; sanitized comment is read from history |
| POST proposals/{UUID}/reconsider/ | version, request_id | explicit lifting of rejection; reanalyzing |
| POST proposals/{UUID}/retry/ | same | retries existing apply checkpoint for apply_retry/apply_error/search_pending |

DTOs use `src/types/intelligenceApi.ts`, validated in `src/api/intelligence.ts`.
The view model preserves source title/calendar/date/time kind/recurrence and source
availability, proposal version, Backend status, plan rationale/actions/matches and
confirmed receipts. Matched UUIDs are identifiers only; the Frontend never sends a
modified plan, Space, owner or graph IDs as mutation authority. No invented match
scores are displayed. History/detail loading and pagination are per proposal UUID.
History shows actual decision versions, comments, plan and apply snapshots as text.
The source is the internal Mroya calendar, including imported Google events; its
origin is not inferred from demo fixtures. Email/Drive remain Design scenarios.

## Actions and confirmation

Backend remains authoritative for every transition. UI action flags mirror the
current contract, not an authorization boundary: accept only pending, available
source and non-clarify/non-skip plans; reject for non-frozen cards; comments and
reconsider require deep processing and an accessible source. A rejected card needs
explicit reconsider. Frozen/committed operations cannot be cancelled by Reject.
Retry resets the same Backend checkpoint, never its memory operation identity.
Analysis errors have no invented retry route: use a permitted comment/reconsider.

Each action reserves a single account-local operation with immutable UUID
request_id, version and body before awaiting transport. Double-clicks are ignored.
Network/5xx/malformed-confirmation uncertainty and CSRF failures retain that exact
operation. The card's Retry repeats it only on an explicit click; another decision
is blocked until it is settled. No automatic POST loop or new key/version replay.
400/404/409 are definite refusals, never success. A 409 refreshes the real card and
shows the conflict; a subsequent deliberate new decision gets a new key and the
confirmed version. 401 cancels/clears the controller and expires the session. 403
retains the request and the existing client refreshes CSRF on the explicit retry.

Operation bodies, comments, cards and history are in memory only. Reload performs
fresh GETs and does not resurrect/replay an old operation. Inspect current status
and history before starting another action after reload. Scope changes discard UI
comment drafts; abort/generation fences discard late data after logout, user or
source/controller replacement. The returned false result preserves a failed comment
draft instead of pretending it was submitted.

## Status and receipt semantics

All Backend statuses are rendered: pending, reanalyzing, rejected, pending_apply,
applying, applied, search_pending, apply_conflict, apply_retry, apply_error, stale,
error, no_proposal. Acceptance is not Saved. Only receipt flags confirm persistence.

- links_saved=true with canonical_saved=false: event linked to memory, no new knowledge.
- canonical_saved=true with search_ready=false: memory saved, Retrieval updating.
- canonical_saved=true with search_ready=true: confirmed memory changes saved.
- apply_conflict after a canonical commit retains its truthful saved receipt and
  reports the source/link conflict; no fabricated rollback or undone facts.

`settings/` capabilities mean implementation availability, not worker liveness.
`status/` runtime switches gate deep actions and apply actions independently. Source
unavailability disables source-dependent actions. Disabled workers show a notice
and no fabricated streaming/progress animation. auto_write=false remains explicit;
no browser analysis, automatic knowledge writing or autonomy settings editor is added.
C2 related_sources is Backend chat enrichment and needs no new browser reader.

## Refresh and pagination

Bootstrap/list refresh occurs only while Memory is visible, plus explicit refresh
and focus/visibility return. Existing loaded cards remain visible during refresh.
Missing routes/capability hide the Inbox without replacing saved memory with demos;
a bootstrap transport error uses the shared retry/status area.

Pending processing uses GET-only polling, 5 seconds, at most 12 rounds per visibility
period, manual refresh or confirmed action; each round rechecks runtime and reads
at most 10 loaded waiting cards, rotating through them. Leaving Memory, hiding the
page or logout stops its timer. Budget exhaustion gives a manual refresh notice.
There is no global Workspace interval. If workers are disabled polling stops.

Offset pages are UUID-deduplicated and sorted in Backend order. After loading an
older page the first page is refreshed once to reduce offset drift. Old versions
and list responses begun before a decision cannot overwrite newer confirmed cards.
There is no messages/all-chats fetch. Confirmed canonical-save or search-ready transitions notify the existing live
workspace controller to re-read the first Saved Memory page and Memory Map. This
never changes Chat history or invents saved facts from a plan/receipt; pagination
continues from the refreshed first page. Existing source IDs remain canonical.

## Validation and first live acceptance

Synthetic API/controller and shared-UI tests cover all statuses/actions, pagination,
idempotency, uncertainty, CSRF, conflicts, receipts/Retrieval, bounded polling,
capability absence, user isolation/logout, history and unchanged Design markup.
The full suite, TypeScript/boundaries, Production/Design builds and fixture verifier
are run explicitly. No real provider request, production write or test user is used.

After separate merge/deployment approval and confirmed compatible Backend C1/C2:

1. Sign in with the owner's chosen account. Open Memory -> Proposals. Verify real
   source/calendar names and settings/status flags. With workers off expect a
   truthful disabled notice and no simulated progress.
2. Review a pending card's detail/history. Reject then explicitly reconsider one
   approved test proposal, or submit a non-sensitive comment; inspect the same UUID
   and the new confirmed history version. Do not use real personal data casually.
3. Only with explicit permission to change that account's memory, confirm a test
   proposal. Expect pending_apply first. Verify the final receipt distinguishes
   link-only from canonical writes and pending Retrieval. Inspect saved memory/map
   through their normal server reads (also verify after reload).
4. Test an old version/another tab: a 409 must refresh and require review, without
   automatic resubmission. Simulate a lost response locally, not by corrupting
   production networking; explicit Retry must preserve the original action key.
5. Check mobile and both themes. Logout during a request and sign into another
   account: proposals/comments/history must not leak. Design remains offline.

Real worker quality, indexing latency, account permissions and production migration
readiness are Backend/live acceptance concerns. This frontend PR does not enable
consent, workers, auto_write or production publication.
