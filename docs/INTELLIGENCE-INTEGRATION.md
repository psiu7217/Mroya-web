# Calendar / Notes / Memory Intelligence integration

Reviewed API main `20936b84f5b09de42153983294be811b0cc9cf38` (Backend PR #42).
The event-status route is merged; deployment must be verified separately.
Source: apps/intelligence/views.py, models.py, triage.py and sources.py.

## Real settings, not Sync consent

Existing Studio source permissions and autonomy cards receive one live
IntelligencePresentation. The original JSX, accents, planned-source placeholders
and responsive styling remain. Design source examples live in the demo adapter.

GET memory-intelligence/settings/ returns settings.autonomy and capabilities.
PATCH accepts only autonomy: review_all or auto_link from Web. auto_write remains
visible but disabled even if an external settings response contains that value.
GET memory-intelligence/sources/?limit=50&offset=0 pages owner-scoped calendars.
PATCH memory-intelligence/sources/calendar/{scope_id}/ accepts only enabled:boolean.
Only the confirmed response changes a radio/checkbox; rejected/uncertain mutations
require read-only Refresh, never an automatic repeat of the PATCH.
GET memory-intelligence/status/ supplies actual worker_enabled/deep_enabled/
apply_enabled, independently shown from capability support and user policy.

Google synchronization, per-calendar AI permission and the separate optional
Google/provider privacy consent are different settings. This change calls no
Google Sync or privacy mutation, grants no consent at mount/connect, and never
handles/ignores an access rejection as success. OPEN Web PR #36 remains separate;
its consent, provider-availability and release restrictions are not bypassed or
replaced. Integrate both branches through normal Git review, retaining all privacy
controls. Gmail/Drive and auto_write are still unsupported.

## Open-event analysis and Inbox

GET memory-intelligence/calendar-events/{event_id}/status/ follows the task's
fixed contract: event_id, source {kind:'calendar',id,enabled}, runtime, nullable
job {status,decision}, nullable proposal {id,status,version,canonical_saved,
links_saved,search_ready}. Existing Backend enums are validated; decision is
candidate|irrelevant|uncertain|null. No job means no claim of completed analysis.
Only the open details modal and explicit Refresh cause reads. Recurring instances
use api.series_id or api.id, never occurrence_id. Closing/switching events,
unmount/logout/account changes abort or invalidate responses. No grid polling,
AI calls, accept or memory mutation runs in the browser.

Pending/processing is distinct from completed receipts; pending_apply/applying
cannot claim saved. Confirmed links_saved and canonical_saved have separate text;
search_pending or an incomplete confirmed retrieval receipt shows retrieval
updating. 404/405/501 gives Unavailable (including inaccessible/deleted resources,
which cannot be distinguished safely); Calendar CRUD/Sync remain independent.
401 expires the session; 403/transport/invalid responses show honest errors/Refresh.

View proposal switches Memory to Inbox and loads the specific owner-checked detail
through LiveMemoryInboxController.focus, even if absent from the first page.
The existing history/actions/controller remain the only decision implementation.
The targeted card scrolls into view once; no automatic Accept occurs.

## Confirmed Memory links

Calendar adapter and Notes detail adapter preserve memory_links. The shared link
presentation shows a deduplicated confirmed count. Names/navigation are resolved
only against entity nodes already returned by the current authenticated Memory
Map reader. The existing Memory Map opens the exact canonical entity ID.
No requests using raw linked UUIDs are added and no labels are fabricated.
Unresolved links remain a neutral count with an availability explanation.

Integration gap: there is no agreed public object-by-UUID reader for links absent
from the currently loaded/truncated map, so those cannot offer names/navigation.
No new endpoint is invented. Existing statement-based Memory details are not
misrepresented as object details. No links are created/deleted by this UI.
Notes Markdown, Copy and ephemeral checklists remain unchanged; no Notes editor.

## Release review

After approved Backend + Web merges/deployments, manually check owned calendars,
explicit permissions, both autonomy choices, a denied permission, operator Deep/
Apply OFF states, and event states across queued/pending/apply/search outcomes.
Check one recurring event, Inbox deep-link/history/actions, and both resolved and
unresolved Calendar/Notes links in Light/Dark and mobile. An empty job must stay
unknown. An old server must keep Calendar working with analysis unavailable.
Use authorized synthetic/disposable data; this implementation's tests made no
real Provider calls, changed no real consent and wrote no production memory.
