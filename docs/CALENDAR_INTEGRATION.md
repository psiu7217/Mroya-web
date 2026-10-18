# Calendar frontend integration

Contract source: [Calendar API, Backend PR #28](https://github.com/psiu7217/Mroya-api/blob/e0fcc38738e83fdfb4a84ff69ff42dc4c8d773ac/docs/CALENDAR-API.md), checked against its Django views, serialization, recurrence expansion and Google configuration code. The frontend depends on this API being installed; it does not install or modify Backend.

`calendar_rest` enables Calendar CRUD; `calendar_rest` plus `connections_rest` enables the shared Google card. Missing/false capabilities keep the existing Coming soon state and issue no calendar requests. There is no Google-specific configured capability: an unconfigured consent service reports its Backend error when Connect is attempted. Google sign-in for Mroya and Calendar consent are independent.

All traffic uses the existing `MroyaApi`/live source, same-origin `/api/v1/`, Django session and CSRF. DTO/read validation is in `src/api/calendar.ts`; presentation and recurrence conversion in `src/hooks/calendarAdapters.ts`; one account-scoped controller/hook in `src/hooks/useLiveCalendar.ts`. Both existing views get the same confirmed Google connection. Design keeps its separate offline simulation.

## REST and recurrence

- GET `calendar/events/?start_date=...&end_date=...&limit=100&offset=...` loads the visible range, paginating and deduplicating occurrences. Changing month/year reloads the range. A bounded 5,000-occurrence client limit reports an error rather than pretending completeness; narrow the view if exceeded.
- POST `calendar/events/`: `{submission_id,event}`.
- GET/PATCH/DELETE `calendar/events/{UUID}/`: detail or versioned mutation (`{submission_id,version,changes}` for PATCH; no changes for DELETE).
- Occurrence UI keys use `occurrence_id`; mutations use `series_id`/`id` and the observed version. Edit fetches the master before populating the existing editor. The date input edits its complete DTSTART. Recurrence edits/deletes affect the entire series; provider exceptions/read-only instances cannot be edited.
- RecurrenceEditor numeric weekdays map to MO–SU; `endDate`/`endCount` map to mutually exclusive `until`/`count`. Backend expands instances, with no second browser expansion in live mode. Opaque Google rules survive ordinary title/time edits and can be replaced with an explicit normalized rule.
- Time is an event-local wall clock with its IANA timezone displayed. Enter HH:MM or `All day`; exact creation uses the account timezone. All-day end dates remain exclusive. No end/duration is invented when the API has none. Unsupported person/counterparty and reminder controls are disabled in live Calendar; their separate APIs are not invented.
- Forms wait for confirmation and retain their draft after failure. A lost response retains the exact mutation body/submission UUID in memory. Only explicit **Retry / check calendar** replays it. A successful retry closes only the matching unchanged form; navigation or a changed draft cannot cause an automatic new write. 409/404 refresh the server range and require review; 401 follows normal session expiry, 403 uses normal CSRF refresh on manual retry.

## Google state

GET `calendar/google/connections/` is authoritative. The account selector and calendar controls use local UUIDs returned there. POST `google/start/` returns a validated Google HTTPS authorization URL; the browser navigates to consent. After authenticated return, `calendar_google` is removed from history and treated only as a notice, then connections are fetched. A `connected` hint never fabricates a connection or sync result.

PATCH `google/connections/{UUID}/` sends `selected_calendar_ids`, `export_calendar_id` or `sync_enabled`. Backend starts initial/catch-up work. POST `.../sync/` requests one cycle without enabling automatic sync. DELETE disconnects the chosen account without deleting local events. Every action is followed by GET; periodic visible-page and focus refreshes show progress. Requests are aborted and late account-scoped results ignored on logout/unmount. No Google credentials or operation state are persisted in browser storage.

Pending/initial/running, partial failures, per-calendar errors, conflicts, reconnect and retry deadlines are presented from confirmed responses. OFF's `paused` status is not mistaken for failure. Turning OFF remains available during work/errors. Conflict has no fake resolution action. Last synced is the backend timestamp, not a browser success timer. The API exposes job totals but no per-event status or import/export counts; the frontend does not turn those into invented success badges/counts.

## First live check (owner)

1. Ensure Backend PR #28, its migrations, worker and Google consent settings are deployed, with the fixed callback configured. This frontend PR does not deploy them. Confirm capabilities advertise calendar REST/connections.
2. Sign in to Mroya. Open Calendar; create a disposable event with a full date and HH:MM (or All day). Reload to confirm persistence. Test a weekly series and edit/delete the entire series, not an occurrence.
3. Open Connections → Google Calendar → Connect. Complete Google consent. After returning, check that the URL hint disappears and the card is confirmed by GET. Initial sync runs once with Auto OFF.
4. Select actual import calendars and a writable export destination. The destination remains included in import selection by Backend. Check Calendar and Connections show the same account/state.
5. Press Sync now while OFF: expect pending → backend-confirmed result, with Auto still OFF. Enable ON and observe catch-up. Disable OFF during work and confirm it stays OFF after subsequent GETs.
6. Revisit/focus the page to see completion/partial errors. Confirm last-synced changes only when Backend reports it. Disconnect and verify Mroya events remain.

No real OAuth consent, user-data mutation or provider calls were performed by automated tests. Full end-to-end Google verification requires the owner's account and deployed Backend. Existing Studio layout/theme/components are retained; the full-date field, account selection and confirmation/error wiring are the required functional changes.
