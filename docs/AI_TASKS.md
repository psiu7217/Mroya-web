# Real AI tasks

Production Chat receives task state/actions from LiveWorkspaceController through
WorkspaceModel. MroyaApi uses the existing session client for GET agent-tasks/
(limit=50, offset, next_offset) and agent-tasks/{uuid}/. Manual POST agent-tasks/{uuid}/execute/ uses the same session/CSRF client.
No retry/clarification-answer endpoint exists. Cards display canonical UUID/type/description/status/timestamps,
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

Queued tasks expose Execute through the existing typed presentation/controller.
All execute buttons lock while one POST is pending or a loaded task is running.
The controller never optimistically changes status; GET polling every second while
a POST is pending reveals Backend running. A terminal POST response is canonical.
Older in-flight GET data cannot overwrite a newer updated_at. Ambiguous POST
failures reconcile with reads and never automatically repeat the command.

started_at / finished_at / duration_ms come from Backend. Cards show local dates,
actual completed duration and elapsed time since Backend start for running tasks.
No estimates/progress percentages are invented. Offline Design has no real Execute
action. No Background Worker is implemented; tasks wait for explicit execution.
