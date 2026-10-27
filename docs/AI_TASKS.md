# Real AI tasks

Production Chat receives task state/actions from LiveWorkspaceController through
WorkspaceModel. MroyaApi uses the existing session client for GET agent-tasks/
(limit=50, offset, next_offset) and agent-tasks/{uuid}/. No write/retry/clarification
endpoint exists. Cards display canonical UUID/type/description/status/timestamps,
result summary and error code. No progress, wait estimates or synthetic results.

Refresh on controller start (including F5), Chat completion/error, panel opening,
focus/visibility return, and every 10 seconds while loaded tasks are unfinished
or the panel is open. Refresh preserves current cards; page expansion re-reads the
loaded page window and de-duplicates UUIDs. Older unfinished loaded tasks that move
outside that window are refreshed by UUID. Counts describe loaded records.

Initial completed rows never trigger a toast. Only a previously observed status
transition to completed does. Logout/expiry/unmount abort and invalidate requests,
clear tasks and notifications, and cancel timers. Nothing persists in browser storage.

Fixtures live only in src/demo/aiTasksData.ts, supplied by the offline Design
provider. Components import no fixtures and perform no API requests. Design retains
the same cards without adding fake production mutation actions.

No Background Worker is implemented; queued tasks remain queued.
