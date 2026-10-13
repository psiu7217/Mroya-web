# Guest chat and session entry

Reviewed base: main `1fe0f3b`, including the user's Studio logo and Google Sign-In form. Those changes were synchronized before this branch began. Date: 2026-10-14.

## Entry and authorization

Production checks same-origin `/api/v1/me/` first. Loading renders a neutral session check, not guest animation. Only an explicit 401 starts the guest shell. Network/server errors offer Try again. Guest sends never call the source/Chat API: only the latest in-memory user message and static sign-in response are rendered. No drafts/storage, backend writes or automatic transfer after login. Closing/reloading the page discards the exchange.

A shared access gate keeps Chat visible and invites sign-in for Calendar, Reminders, Memory, Memory Map, Connections, Settings and unsupported guest actions. The gate makes zero personal API calls. Backend authorization remains authoritative.

Greeting: 350 ms pause, three dots, then static welcome at 1850 ms. Reduced motion skips the dots and uses no CSS animation. Timers are cleaned up on unmount; submitting early reveals the greeting without a model request.

Chat, sidebar and gates open one native modal dialog around the Studio LoginScreen. Existing logo, Google SVG, typography, inputs and button styles remain. Native dialog with explicit Tab/Shift+Tab edge wrapping traps keyboard focus and makes the application inert; Username receives focus, Escape/Close dismiss and focus returns to the trigger. Password is cleared after submission. Django CSRF/login/logout/session transport is reused without client-side session simulation. Modal and guest state unmount when authenticated. Logout confirms server logout before returning to guest; network errors cannot pretend to log out.

## Minimum live workspace

Shared Sidebar, ChatWorkspace, MemoryView and MemoryMapView render actual backend DTOs. The controller fetches capabilities, chronological history with older-page loading, memories with page loading, and canonical map nodes/relationships. Sends use a single retained UUID and SSE POST; updates reconcile with server history. Guest messages are never submitted after login. Reload reads server data again.

Ambiguous stream interruption disables another send and exposes Check server status, using the original turn ID. There is no automatic POST retry/new UUID. If headers were lost, review history and reload before another submission. Server-side UUID idempotency remains authoritative. Stale responses are ignored after logout/unmount. Read-only memory cards keep canonical IDs; ask in chat to mutate memory. Map truncation is stated. Calendar/reminders/connections/subscriptions, attachments/voice and creating separate conversations are explicitly unavailable; no synthetic data is saved.

This is the minimum supported workspace, not full feature parity. Rich memory provenance/detail fetching, broader settings and unsupported features remain future work.

## Google OAuth requirements (backend task, not implemented)

Current public config/urls.py exposes `/api/v1/` and admin only; API routes have no Google start/callback. Existing identity/allauth provider modules alone do not expose a usable public flow. Button remains visible and disabled with Coming soon in both roots; no simulated Google login or browser credentials.

A backend-owned authorization-code flow needs an agreed start and callback route under the public API namespace, creation/linking of the account, Django session establishment and CSRF rotation, state validation and validated identity. Proposed routes ONLY, requiring backend agreement: `/api/v1/auth/google/start/` and `/api/v1/auth/google/callback/`. They do not exist and the frontend does not call them.

Google Cloud needs a Web application OAuth client ID and client secret stored on the backend, a consent configuration with appropriate audience/test users, and openid/email/profile scopes. Proposed exact redirect URI after backend agreement: `https://app.heymroya.com/api/v1/auth/google/callback/`. Register exactly the actual deployed backend callback; do not register this proposal as a working endpoint. After callback, redirect safely to the Web app, whose `/me/` check loads the verified session. See [Google's server OAuth documentation](https://developers.google.com/identity/protocols/oauth2/web-server). No signup endpoint is exposed today; guest wording promises sign-in rather than fictitious free self-registration.

## Verification and cutover

Automated checks cover bounded network-free guest exchange; capability gates; live serialization and authoritative reload; interruption recovery without resend; 401 vs network failure; canonical mapping; stale response disposal; existing CSRF/SSE tests; type contracts and separate bundle boundaries. Filled Studio workspace markup (normalizing only generated SVG IDs) is compared against the immutable synchronized main baseline `1fe0f3b`, replacing the pre-Studio logo baseline. BrandMark now uses unique gradient IDs to fix hidden/mobile SVG reference collisions, without changing paths, colors or dimensions.

Manual optimized-build checks use a temporary localhost-only HTTP contract server, not Django or real accounts: guest welcome/send/Memory gate; shared form/disabled Google; wrong password; successful cookie-session login; live SSE/history reload/memory/map; unsupported sections; logout; `/me/` server error/retry. Desktop and mobile checks and Design scenarios are recorded in the PR. This fixture server is not shipped in frontend bundles.

Production is unchanged. Before cutover, verify real Django session cookies/CSRF and account access through HTTPS using a designated test account in an approved non-production environment, exercise one chat turn and reload, and review the release/rollback. No real account credentials were supplied for this task, so fixture checks are not presented as real-account end-to-end proof. Google OAuth and full feature parity are not requirements for releasing the supported username/password minimum, but must remain explicitly unavailable.
