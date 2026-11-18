# Notes read integration

The single shared `NotesView` uses `NoteItem` props and optional `NotesPresentation`
state/actions. Studio fixtures remain in `src/demo/notesFixtures.ts` and are provided
only by `useDemoWorkspace`. The UI owns no HTTP or persistent storage.

## Availability and contract

Backend source of truth: [API Notes section](https://github.com/psiu7217/Mroya-api/blob/main/docs/API.md#notes),
[PR #38](https://github.com/psiu7217/Mroya-api/pull/38), reviewed at
`255a4ae444eef168e0d25edf42df7cf8d0fe7e36` (merged into API main).
Merge does not establish deployment. An authenticated live source enables Notes
only when Backend confirms `notes_read === true` and both read methods exist.
Absent flags on older servers stay unavailable. Guest has no Notes source. The
internal `notesAvailable` presentation gate is derived from these conditions in
Production; query strings/storage/demo switches cannot enable it.

`MroyaApi.notes(offset, signal)` uses GET `/api/v1/notes/?limit=20&offset=...`.
`MroyaApi.note(uuid, signal)` uses GET `/api/v1/notes/{uuid}/`.
Both use the existing session/same-origin client and bounded response validation.
No Notes write endpoints or additional auth/CSRF system are introduced.

The existing SSE activity validator also accepts the exact Notes tool projections
from Backend `apps/agent/live_tool_activity.py`: null inputs, `get_note` output
`{note_read:true}`, create/update `{note_action,search_ready:boolean|null}`, delete
`{note_action,search_removed:boolean|null}`. All phase/lifecycle/size limits remain;
no body, UUID or arbitrary tool fields are accepted. This prevents a valid Chat
Notes operation from being cancelled as `invalid_stream`. Chat UI/controller are
unchanged.

List responses contain metadata only; opening one card fetches that body and its
verified `memory_links`. They are retained in controller memory only. Keywords map
to tags; categories, source, readTime and noteType are not invented. Search covers
loaded titles, summaries, keywords and search phrases, not unloaded pages or full
bodies. Pagination follows `has_more`/offset, deduplicates UUID and keeps Backend
updated-date/UUID descending order. Load more never fetches bodies.

Entering Notes reloads the first page, including after creating/updating/deleting
a note in Chat. A Chat operation finishing while Notes is visible also refreshes
metadata. There is no Agent invocation, polling or mutation in Notes. Loading and
retryable errors are distinct from a confirmed empty response. A 401 expires the
session and clears Notes; 403/404 do not imply empty data or a successful read.
Section exit cancels reads and closes detail. New requests, account changes and
logout invalidate old responses. The per-controller UI key also discards local
checkbox state between accounts.

## Reading and local checklist state

Markdown stays read-only with GFM and the existing safe URL policy: raw HTML is
skipped, remote images are not loaded and external links are isolated. Canonical
content (including whitespace/line endings) is passed unchanged to Markdown/Copy.
Copy and body rendering require confirmed detail, never a summary placeholder.

Checklist overrides use parsed source positions and local Boolean values. Reset
clears marks without rewriting text. Changed content invalidates old overrides;
unmount/reload discards them. Enter/Space work without toggling nested parent tasks
or intercepting links. Clipboard rejection/late completion cannot claim Copied on
another note. Server-side checklist persistence remains a separate API + Frontend
change; this PR sends no writes and uses no localStorage.

## Verification and first live check

Run `npm ci`, TypeScript, boundaries, `npm test`, both builds and the production
bundle verifier. Targeted coverage lives in `tests/notes-api.test.ts`,
`tests/notes-interactions.test.mjs` and `tests/notes-view.test.mjs`.

After the owner deploys the approved Backend/Frontend, sign in and verify the
capability. Open Notes: check empty/error/Retry, then use Chat to save a disposable
note during an explicitly authorized manual test. Return to Notes, open the card,
check exact Markdown/Copy, pagination, local checks/Reset and reopen/reload. Notes
must stay hidden on older Backend versions. Design (`npm run dev`) keeps local
fixtures, categories, search and Empty State without Backend requests. Review
Light/Dark and mobile through the existing theme/navigation controls.
