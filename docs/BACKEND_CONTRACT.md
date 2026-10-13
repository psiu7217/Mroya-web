# Backend contract inventory

Source: `psiu7217/Mroya-api`, reviewed commit `504e67c` (`apps/api/views.py`, URL configuration and tests). Read-only inspection; no API changes. Preferred browser base is the fixed same-origin `/api/v1/` on app.heymroya.com. The separate api.heymroya.com address is not used by the browser client.

| Endpoint | Prepared behavior |
| --- | --- |
| GET auth/csrf/ | Read csrf_token; no token storage beyond client memory |
| POST auth/login/ | username/password, X-CSRFToken, rotated csrf_token and user |
| POST auth/logout/ | empty JSON body, status logged_out, rotated token |
| GET me/ | user id/username/email/names/timezone; 401 means guest |
| GET chat/messages/ | sequence cursor before; messages, conversation_id, next_before |
| POST chat/send/ | content, submission_id UUID, optional timezone/retry; SSE or completed JSON replay |
| GET chat/turns/{UUID}/ | existing recovery endpoint: turn_status, summary, events; optional result/error fields |
| GET memories/ | state active/history/all, q, offset, limit; canonical records and total |
| GET memories/map/ | entity/memory nodes, edges, truncation and optional statistics |
| GET capabilities/ | actual capability flags, never guessed from visual availability |

Django owns Secure/HttpOnly session cookies. Fetch uses credentials same-origin, redirect error and no-store. CSRF applies to login and all writes; token rotation is handled. No browser API keys, session tokens in storage, direct database access or cookie parsing. Non-401 errors remain errors; mock records never replace failed live requests.

SSE uses fetch POST, not EventSource. It accepts trace/delta/done/error frames across UTF-8/chunk/CRLF boundaries. EOF without done is an interrupted stream. Capture X-Chat-Turn-ID, retain the original submission UUID, inspect turn/history after interruption, and only then decide whether to retry. Do not create a new UUID or automatically repeat an ambiguous write. The current backend reports sse_token_streaming=false, so do not promise token-by-token model output.

Canonical memories retain UUIDs and raw provenance/history fields; UI demo IDs are not backend IDs. The next workspace adapter must deliberately map API DTOs to presentation contracts and preserve server authority. Do not send local demo mutations to imaginary REST endpoints.

Actual capabilities: chat=true, memory_read=true, memory_mutations_via_chat=true; memory_mutations_rest=false, calendar_rest=false, connections_rest=false, reminders=false, local_recurrence=false. No subscription management endpoints were found. Unknown capabilities mean unsupported. Calendar, reminders, connections and subscription screens are retained for design; live interactions must be disabled or explicitly marked unavailable until backend support exists.

Session entry and the minimum shared live workspace now use these transports; see GUEST_CHAT.md. Real account login, chat recovery, persistence across refresh, memory mapping and capability-driven UI must be tested against Django before a separate production cutover. No production database writes or credentials were used for these preparation tests.
