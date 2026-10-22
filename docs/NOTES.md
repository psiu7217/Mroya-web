# Notes integration boundary

Notes uses the shared `NotesView` and the `NoteItem` presentation type. Studio
fixtures stay in `src/demo/notesFixtures.ts` and are provided only by
`useDemoWorkspace`. The shared UI does not import demo data or own HTTP/storage.

`WorkspaceModel.notesAvailable` is an internal presentation gate, **not** an
invented Backend capability. Only the offline source currently sets it true.
Production explicitly sets false, and Guest defaults false: Notes is absent from
navigation, including the collapsed/mobile sidebar. A stale Notes selection falls
back to Chat instead of claiming a successfully loaded empty list. The Empty State
switcher additionally requires Design preview; it cannot select a production data
source through query string or browser storage.

When Backend Notes is ready, verify its real capability and DTO contract, reuse
`src/api/`, session/CSRF and hooks/providers, and map confirmed records into
`NoteItem[]`. Enable this gate only after the source is configured, with honest
loading/error handling. No endpoint/client or fake successful load is implemented
here. The existing list/reading view, search/filter and Markdown can be reused.

Markdown is read-only, with GFM and the existing safe URL policy: raw HTML is
skipped, remote images are not loaded and external links are isolated. Checkboxes
use local Boolean overrides keyed by the parsed task's source position. Canonical
`NoteItem.content` is always passed unchanged to Markdown and Copy. Reset clears
local marks, not the note text; changed source text invalidates old marks. Unmounting
the Notes view or reloading clears the temporary state. No persistence or
Backend mutation occurs. Counts use actual rendered GFM tasks, not regex matches
inside code fences. Keyboard Enter/Space work without toggling parent/nested tasks
or intercepting links. Clipboard rejection/late completion cannot claim Copied on
a different note.

To review Studio: `npm ci`, `npm run dev`, open Notes. Check search/categories,
Empty State, a note with a table, and the hiking checklist with click, Tab,
Space/Enter and Reset. Switch Light/Dark using the existing Appearance controls.
Synthetic regressions: `tests/notes-view.test.mjs` and
`tests/notes-interactions.test.mjs`. Production bundle verification rejects Notes
fixture identifiers/content in addition to the existing private demo markers.
