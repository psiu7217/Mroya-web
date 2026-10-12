# Mroya architecture decision — frontend and backend separation

Status: **Accepted (2026-10-12)**

## Decision

Mroya is a chat-first application with an independent frontend and backend. Keep the existing `Mroya-web` repository as the UI source of truth and continue using `Personal-Memory-OS` for agent orchestration, long-term memory, data, access control and calendar operations. **Do not rewrite or duplicate the memory engine inside the frontend.**

## Repositories and responsibility

| Repository | Responsibilities |
| --- | --- |
| [Mroya-web](https://github.com/psiu7217/Mroya-web) | React UI, routing, styles, presentation state, API clients, user interaction, frontend testing and deployment |
| [Personal-Memory-OS](https://github.com/psiu7217/Personal-Memory-OS) | Django APIs, authentication/authorization, agent, memory, retrieval, persistence, calendar, connectors, backend tests and deployment |

Frontend baseline: React 19, TypeScript, Vite 8, Tailwind CSS 4, Lucide icons, Mroya brandbook design tokens. Proposed additions, not yet installed: React Router, TanStack Query, Vitest/Testing Library, Playwright.

Backend baseline: existing Django application and its existing data/services. Backend is the sole authority for user-specific data, entitlements and mutations.

## API boundary

- Use a documented, versioned API (proposed `/api/v1/`) between React and Django.
- Prefer same-origin routes for the production app, with Traefik routing the frontend and API, using secure session cookies and appropriate CSRF protection.
- Use HTTP/JSON for ordinary operations and SSE for streaming AI chat responses.
- Define request/response contracts and error handling centrally.
- Do not let frontend components execute direct database queries or include API secrets.
- Maintain compatibility across independent frontend/backend releases; contract tests are required before deployments.
- Adapt existing Django services/endpoints rather than moving business logic into React.

## Separation inside Mroya-web (target, not yet implemented)

- `src/components/` and `src/pages/`: mostly presentational UI.
- `src/api/`: HTTP clients, auth/CSRF handling and SSE transport.
- `src/hooks/`: server state and data coordination.
- `src/types/`: explicit shared-facing API types.
- `src/styles/`: visual tokens, theme and layout.
- Keep mock/demo fixtures separate from real production data paths.
- API integrations must not be implemented inline in large JSX components.

## AI-assisted design workflow

1. Visualize and adjust layouts in Google AI Studio Build.
2. Use GitHub sync to review imported/upstream code and push UI changes.
3. Use Codex to integrate frontend with Django, implement service logic and add tests.
4. Review diffs and run frontend tests/build and backend API contract tests before release.
5. Deploy frontend and backend independently after staging validation.

**AI Studio may rewrite any file it edits. GitHub sync is not a semantic merge of business logic.** Avoid assigning generated editing tasks to API, auth, or infrastructure files. UI component contract changes must be code-reviewed.

## Deployment direction

- Frontend: Vite static build served from Nginx container.
- Backend: existing Django containers/services.
- Traefik: HTTPS routing; preferably frontend `/` and backend `/api/v1/` on one application origin.
- Domain name, route map, session migration, CI/CD and production cutover require separate implementation decisions.
- Do not automatically deploy unreviewed AI Studio commits to production.

## Current status and constraints

This document records an **architecture decision**, not completed integration. As of acceptance, the Mroya-web UI is largely a mock-driven React prototype: `App.tsx` owns local memory/chat/calendar state and fabricated responses. Authentication, persistent storage, server-side subscriptions and production API integration are not yet implemented here.

Existing Django endpoints and behaviors must be inventoried before specifying final HTTP contracts. In particular, the existing chat SSE protocol, calendars, memory detail and map authorization should be reused with compatible adapters as needed.

## Acceptance criteria for the first integration phase

1. Existing visual appearance remains intact.
2. Authentication and user permissions are enforced by Django.
3. Chat replies and conversation history come from the backend and persist across refreshes.
4. Memory and calendar operations use real backend APIs instead of local mock state.
5. TypeScript build, API contract tests and basic end-to-end smoke checks pass.
6. UI-only updates from AI Studio can be reviewed and incorporated without rewriting the API client.
