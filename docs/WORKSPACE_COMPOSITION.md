# One visual Workspace

WorkspaceView is the sole authenticated workspace composition for Design and Production. LiveWorkspace was removed after Settings PR #11 merged (base main fce3d7e). Google AI Studio changes the common components/pages; neither source owns a separate page layout.

## Audit and migration

| Screen/area | Previous Design | Previous Production | Difference/cause | Shared result |
| --- | --- | --- | --- | --- |
| Shell/navigation | WorkspaceView + Sidebar | LiveWorkspace + Sidebar | Two independently maintained page trees/shell sizing | WorkspaceView + identical Sidebar, dynamic viewport height |
| Loading/error | Separate DesignRoot overlay | LiveWorkspace status bar | Separate feedback markup | Shared WorkspaceView feedback slot; Design retry clears a local scenario |
| Chat | ChatWorkspace + MemoryContextPanel | ChatWorkspace without context panel | Live toggle navigated to Memory | Same chat/panel composition; controller history/SSE/Markdown/copy unchanged |
| Calendar | CalendarView | Unavailable notice | No agreed calendar REST contract | CalendarView, empty arrays, disabled creation, Not available yet |
| Reminders | RemindersView + ReminderEditorModal | Unavailable notice | No reminders API | Same list/filter/empty structure, no fake actions, creation disabled |
| Memory | MemoryView | MemoryView in separate shell | Separate loading/pagination wrappers | Same MemoryView, read-only REST operations, shared pagination slot |
| Memory Map | MemoryMapView | MemoryMapView in separate shell | Separate truncated-map notice | Same canonical server graph and shared notice slot |
| Connections & Account | ConnectionsSettingsView | Same component in LiveWorkspace after #11 | Separate composition/prop mapping | One occurrence in WorkspaceView, confirmed preferences retained |
| Modals | Plan preview + ReminderEditorModal | Absent | Backend operations unavailable | Shared modal composition; live keeps unsupported open flags false |

## Data and actions

Design: useDemoWorkspace -> WorkspaceModel -> WorkspaceView.

Production: LiveExperience uses the existing useLiveWorkspace/controller, useUserPreferences and useWorkspaceLayout -> canonical DTO adapters -> WorkspaceModel -> WorkspaceView.

The existing flat typed model remains compatible. Its optional runtime presentation props carry loading/error/pending, capabilities, pagination, notices, confirmed preferences, logout and unavailable actions. This is not a second client or data store. Components emit actions; API/session/CSRF/SSE/account lifetime remain in existing layers. Query/storage controls cannot select a demo provider in production.

Chat/memory availability comes from capabilities. Calendar/reminders and REST memory mutations are unavailable under the agreed Backend contract even if an unimplemented flag appears; no routes are invented. Unsupported arrays stay empty; service cards contain no fictional user identities. Failed supported requests show error/retry and retain loaded server records, rather than demo data or Coming soon.

The context panel shows explicitly selected loaded canonical memory. No relationship/calendar commitment is invented. A map memory outside the loaded list gives a notice to load more records. Server graph truncation remains explicit.

Calendar examples/account labels enter only through calendarSamples in the demo source. Live has no demo samples, protected-focus-hours claim or synced account. Date navigation is presentation-only: live starts at the browser date, Design retains its fixed preview date. This adds no calendar persistence.

Shared Settings retains the Studio nickname editor, backend-confirmed save/clear, Unicode validation, draft protection, retry and read-only timezone. Guest welcome/login screens stay outside authenticated Workspace composition and retain existing gates.

## Regression checks

The boundary scanner rejects restoring LiveWorkspace or importing page components directly into LiveExperience. Tests compare the same components for equivalent synthetic inputs, Sidebar/tabs/modals, unavailable actions, canonical DTOs, error/loading/pagination and offline Design. They do not compare demo fixture content to real account data. Bundle verification still rejects demo data/identity and the Design entry.

The current Studio SSR assertion allows only two intentional shell changes: dynamic viewport sizing and a common flex wrapper/status area. The original PNG/logo baseline stays enabled and is tracked separately.

Run existing lint, boundaries, tests, Production build/bundle verification and Design build. Review desktop/mobile navigation, scrolling, context, Markdown/Copy and theme/error/retry. Real authenticated server readback requires the owner's account check; no production users/data are created for tests.

See [AI Studio workflow](AI_STUDIO_WORKFLOW.md) and [Backend contract](BACKEND_CONTRACT.md).
