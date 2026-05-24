# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Monorepo with two npm packages and a shared deployment:

- `backend/` — Node.js + Express + TypeScript API (port 3000)
- `frontend/` — Vue 3 + Vite + TypeScript SPA (Tiptap editor, Pinia, vue-router)
- `database/` — `schema.sql` + `seed.sql` for Postgres + pgvector
- `k8s/meeting-notes.yaml` — Deployment, Service, Ingress, PVC (namespace `ai-platform`, host `meeting.kaflix.com`)
- `Dockerfile` — single image that builds frontend into `backend/public/` and serves it from the Node process
- `build.sh` / `restart.sh` / `stop.sh` — local dev + k3d deploy helpers
- `Jenkinsfile` — CI: kaniko build → push to `172.10.65.80:5000/kaflix/meeting-notes` → `kubectl apply`

## Common commands

Local dev (two processes — `./restart.sh` orchestrates both):
```bash
cd backend && npm run dev       # ts-node, port 3000
cd frontend && npm run dev      # vite, port 5173, proxies /api and /uploads to :3000
```

Single-process production locally:
```bash
cd backend && npm run build:all   # builds frontend → ../backend/public, then tsc
cd backend && npm start           # NODE_ENV=production, serves SPA + API on :3000
```

Frontend type-check (no separate lint/test scripts exist):
```bash
cd frontend && npm run build      # runs vue-tsc -b before vite build
```

Database init:
```bash
psql -h <host> -p <port> -U pgadmin -d meeting_notes -f database/schema.sql
psql -h <host> -p <port> -U pgadmin -d meeting_notes -f database/seed.sql
```

K8s deploy to local k3d cluster (`dev-cluster`):
```bash
./build.sh   # docker build → k3d image import → kubectl set image
```

## Architecture

### Single-binary deployment
The Node backend (`backend/src/app.ts`) serves the API at `/api/*` AND the built frontend as static files from `backend/public/` with SPA fallback. In dev, Vite proxies `/api` and `/uploads` to `:3000`. The frontend axios client uses `baseURL: '/meeting/api'` and the Vite proxy rewrites `/meeting` away — note that the prod ingress now serves at the **root** of `meeting.kaflix.com` (BASE_PATH was removed in commit `4b3519f`), so anything assuming a `/meeting` URL prefix needs to be checked carefully.

### Report → final_report auto-merge (LangGraph)
`backend/src/services/workflow.ts` defines a 5-node StateGraph that fires when a report is saved:

```
collectReports → groupByTeam → analyzeReports → generateFinalReport → saveFinalReport
```

`analyzeReport` and `generateFinalReportHtml` (in `aiService.ts`) call Claude (`claude-sonnet-4-6`) via `@anthropic-ai/sdk`. Prompts are loaded from `backend/src/prompts/*.md` at module init via `fs.readFileSync` — the Dockerfile explicitly copies these files to `dist/prompts` because `tsc` does not. **If you add a new prompt, update the Dockerfile copy step.**

There are two merge paths: the LangGraph workflow above, and `services/mergeService.ts`'s `mergeReportsManual` which groups reports by `(report_date, department_id, tag_signature)` — the `final_reports` table is keyed on that triple (see the ON CONFLICT clause in `workflow.ts`). The schema has evolved beyond `database/schema.sql`: code references `departments`, `tags`, `notices`, `meeting_notes`, and `tag_signature` / `department_id` columns on `final_reports` that the committed schema does not yet include. Treat the committed SQL as out-of-date and read the service files for the live shape.

### RAG
`services/ragService.ts` chunks report text, embeds via Claude, and writes to `document_embeddings` (pgvector, 1536-dim, HNSW + cosine). Embedding runs as a background promise after the merge workflow returns — failures are logged but don't surface to the caller.

### Tiptap editor + image upload
The rich text editor pastes images via a custom Tiptap extension (`frontend/src/extensions/clipboardImagePaste.ts`) that POSTs to `/api/images` and inserts the returned `/uploads/...` URL. See `tiptap-clipboard-image-paste.md` for the full pattern. The `uploads/` directory is a mounted PVC in k8s (`meeting-notes-uploads-pvc`), so don't assume it shares storage with pods.

## Environment & secrets

Backend reads from `process.env` (loaded via `dotenv` in dev, injected via k8s Secret `meeting-notes-secret` in prod):
- `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` / `PGSSLMODE`
- `CLAUDE_API_KEY`
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` (nodemailer for notifications)
- `PORT` (default 3000), `NODE_ENV`, `EXTERNAL_URL`

The README and `feat.md` contain example DB connection strings; do not assume those are still current — use what's in `k8s/meeting-notes.yaml` and the cluster Secret.

## MCP

`.mcp.json` registers an `agent-meeting-mcp` JDBC server (jbang) pointed at the dev Postgres. Available for direct SQL queries during development.

## Conventions

- Comments and user-facing strings in this codebase are in Korean. Match the existing language when editing.
- TypeScript everywhere — both packages. `tsc` for backend, `vue-tsc` for frontend.
- No test framework is configured. There are no `test` scripts in either package.json.
