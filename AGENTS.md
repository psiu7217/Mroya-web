# Mroya Web editing boundaries

This is the single React frontend. Preserve the existing design and responsive behavior.

Mroya API is the source of truth for user identity, data and business logic. Before implementing a feature, read [BACKEND_CONTRACT](docs/BACKEND_CONTRACT.md), which links the canonical API/OAuth references. Use the existing src/api/ client, hooks and providers with same-origin /api/v1/, Django session cookies and CSRF. Do not create a second client/auth system, store secrets in React, invent backend endpoints, or present demonstration data as real. If an endpoint is missing, explain the required API work.

Visual components/pages/styles/assets use the existing typed WorkspaceModel props and emit actions. No requests, cookie/storage access or demo imports in presentation files. Preserve compile-time offline Design Mode for AI Studio.

AI Studio may implement a small frontend integration when explicitly assigned, using existing contracts. Changes to API/auth architecture, hooks/providers, types, demo/build configuration, dependencies, tests/CI and deployment require architectural Git review. Instructions are not enforcement: inspect the entire diff. Detailed safe-file, synchronization and verification rules live in [AI_STUDIO_WORKFLOW](docs/AI_STUDIO_WORKFLOW.md); do not duplicate them elsewhere.

Codex changes should use an isolated branch and PR. The owner's current Google AI Studio integration pushes directly to `main`; review every Studio diff before release. GitHub Actions are intentionally disabled. Keep repository tests available for explicit execution when relevant, without creating automatic CI or deployment. Production Docker builds still require `package-lock.json` and `npm ci`. Follow [DEPLOYMENT.md](DEPLOYMENT.md): a clean psiu HTTPS main checkout, tracked consistent lockfile, production Docker typecheck/build/bundle checks, Web-only Compose and local Nginx HTTP. No release archives or automatic/legacy rollback; correct main with a reviewed fix/revert and publish again within release authorization. Keep deployment separate from helper installation. Public HTTPS/account checks are explicit release review, not the standard helper. If real credentials are unavailable, mark positive login as pending the owner's manual check; do not create production test users or change real user data.

Do not modify Mroya API runtime, Personal Memory OS, landing, production databases, Traefik, Docker daemon or unrelated Docker resources. Documentation work in a separately authorized API PR does not authorize an API runtime deployment.
