# Mroya Web editing boundaries

This repository is the single React frontend. Preserve existing visuals and responsive behavior. Visual tasks should edit components/pages/styles/assets through the explicit WorkspaceModel props; do not place API requests, cookie/storage access, credentials or demo data into presentation files.

API/authentication/hooks/providers/demo/types/build/CI changes require explicit architectural review. AI Studio instructions are not enforcement: inspect the entire Git diff. Follow docs/AI_STUDIO_WORKFLOW.md and docs/BACKEND_CONTRACT.md.

Use an isolated feature branch and PR. Run boundaries, lint, tests and both builds. Do not deploy the preparation branch: the live workspace adapter remains pending. Do not modify Mroya-api, Personal Memory OS, landing, production databases, Traefik or unrelated Docker resources.
