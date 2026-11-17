# File attachments

## File library

Files is the second primary navigation item, immediately after Chat. Its list
and grid include every owned file, including excluded screenshots, unclassified
uploads and failed processing. Folder cards and breadcrumbs browse the owner's
category tree. Library search filters names, descriptions and keywords without
applying the Agent's search exclusions. Pagination and sorting are server-owned.

Selecting a file opens its original download, category, processing/coverage,
description, keywords, optional selected information and all recognized source
pages. Images use their same authenticated original URL for a detail preview.
The user can correct title/description/keywords and move a file to an existing
folder. Corrections carry `analysis_version`; conflicts and ambiguous writes
reconcile through GET, never an automatic repeated PATCH. Originals stay intact.
New folders are created explicitly; the per-folder search checkbox uses the
existing versioned category policy API and shows inherited exclusion.

`FilesController` and `useFiles` own cancellable account-local reads, deliberate
uploads and corrections, refresh and bounded polling while processing is visible.
`FilesView` only receives presentation state and emits actions. It performs no
API or storage operations. Logout discards state and cancels outstanding work.
Offline Design has separate example files and never downloads originals or calls
the API. Original uploads still use the existing idempotent multipart transport.

Companion library API changes must be deployed before this interface. The old
attachment and Chat contracts remain compatible.

Companion API contract: [Mroya API document service](https://github.com/psiu7217/Mroya-api/blob/codex/document-library/docs/DOCUMENTS.md).
`capabilities.documents===true` enables real selection in the shared chat
composer. Missing/false keeps the existing unavailable behavior. Offline Design
Mode keeps its sample attachment and makes no requests.

`MroyaApi` owns multipart upload, session/CSRF and DTO/link validation.
`DocumentUploads` owns account-local upload IDs and processing polls.
`LiveWorkspaceController` owns the send lock, confirmed conversation, attachment
IDs, account cancellation, canonical history and message acknowledgement.
`ChatWorkspace` only selects File objects and renders typed attachment cards;
it performs no HTTP/storage operations. File contents are never encoded into
Chat text, localStorage, URLs or telemetry by the frontend.

The composer accepts at most eight files of 1 byte–25 MiB each. The whole batch
is stored before waiting up to sixty seconds for processing. Longer work is
sent with its truthful pending state and continues in the backend. Failed
analysis does not remove the original. The message keeps stable owner-authorized
download links and displays the assigned category path and effective search
flag. Pending work is not presented as a final search-policy decision.

A manual retry after an ambiguous upload response reuses the same in-memory
upload UUID for that File. Logout/disposal aborts polls and prevents late
callbacks from dispatching a chat turn into another account. The actual Chat
POST includes document IDs and submission UUID; files are not acknowledged as
sent until the server confirms the turn or completed replay. Failed pre-send
uploads retain the composer selection and text. Category policy is entirely
backend-owned; the category-settings UI is a later feature.

Analysis depth is model-selected. A title, summary and search keywords can be
the complete result; dates, selected facts and values are optional. The optional
`keywords` DTO field is validated when present, while older responses remain
compatible. The frontend does not classify documents or require numeric data.

Deploy the companion API migration, shared private volume and worker before
enabling the capability. Frontend deployment alone does not provide storage or
OCR. Review the active ingress's upload-size limit separately; this change does
not modify protected Nginx, Traefik or service routing. Existing session/auth,
Markdown handling, responsive layout and Design Mode remain shared.
