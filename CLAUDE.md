# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Monorepo with two npm packages and a shared single-image deployment:

- `backend/` — Node.js + Express + TypeScript API (port 3000), PostgreSQL via `pg`
- `frontend/` — Vue 3 + Vite + TypeScript SPA (Tiptap editor, Pinia, vue-router)
- `database/` — `schema.sql` + `seed.sql` (**out of date — see Persistence below**)
- `k8s/meeting-notes.yaml` — Deployment, Service, Ingress, PVC (namespace `ai-platform`, host `meeting.kaflix.com`)
- `Dockerfile` — single image: builds frontend into `backend/public/`, Node serves both
- `build.sh` / `restart.sh` / `stop.sh` — local dev + k3d deploy helpers
- `Jenkinsfile` — CI: kaniko build → push to `172.10.65.80:5000/kaflix/meeting-notes` → `kubectl apply`

## Common commands

Local dev (two processes — `./restart.sh` orchestrates both):
```bash
cd backend  && npm run dev      # ts-node src/app.ts, port 3000 (runs live TS; no watch/reload)
cd frontend && npm run dev      # vite, port 5173, proxies /api (+ /meeting/api, /uploads) to :3000
```

Single-process production locally:
```bash
cd backend && npm run build:all   # builds frontend → ../backend/public, then tsc → dist/
cd backend && npm start           # NODE_ENV=production, runs dist/app.js, serves SPA + API on :3000
```

Type-check (no lint or test scripts exist in either package):
```bash
cd backend  && npx tsc --noEmit
cd frontend && npm run build       # runs vue-tsc -b before vite build
```

K8s deploy to local k3d cluster (`dev-cluster`): `./build.sh` (docker build → k3d image import → `kubectl set image`).

> `npm run dev` runs TypeScript directly via ts-node; `npm start` runs the last `tsc` output in `dist/`. After changing `src/`, the dev process must be **restarted manually** (no watcher), and `dist/` must be rebuilt before `npm start` reflects changes.

## Persistence — PostgreSQL, written natively

`backend/src/config/database.ts` exports a plain **`pg` `Pool`**. All queries are native node-postgres:

```ts
const { rows } = await pool.query('SELECT ... WHERE x = $1', [val]);   // $1,$2 placeholders, { rows } result
const result   = await pool.query('INSERT ... RETURNING id', [...]);   // result.rows[0].id, result.rowCount
```

Use `$1` placeholders and PostgreSQL dialect (`ON CONFLICT`, `string_agg`, `= ANY($1)`, `unnest`, `RETURNING`). There is no ORM and no mysql compatibility layer.

`config/initDb.ts` `initDatabase()` **only runs a connection check** (`SELECT current_database(), version()`) at startup — it does **not** create or migrate tables. The schema lives only in the database; `database/schema.sql` is stale and does not match the live shape. To learn the real schema, query the live DB (or use the MCP server below), not the committed SQL.

### Two databases on the same server — easy to get wrong
PostgreSQL at `172.10.65.80:30432` (k8s NodePort) hosts two databases:
- **`meeting_notes`** — the **live/production** DB used by `meeting.kaflix.com` (full schema: `users.email`/`is_admin`/`keycloak_sub`, `final_reports.department_id`/`team_id`/`tag_signature`/`analysis_html`/`share_token`, …).
- `agent_meeting` — an **old/stale** DB with a reduced schema and far fewer rows.

A backend pointed at `agent_meeting` will appear to work but show wrong/missing data and break newer features. Confirm `DB_NAME=meeting_notes` first when debugging "missing data". (`dotenv` does not override already-set env vars, so you can pin a DB by exporting `DB_*` before `npm run dev`.)

## Architecture

### Single-binary deployment
`backend/src/app.ts` serves the API at `/api/*` and (in production only) the built SPA from `backend/public/` with `*` → `index.html` fallback. The frontend axios client uses `baseURL: '/api'` and Vite's `base` is `/`. In dev, the Vite proxy forwards `/api`, `/meeting/api`, `/uploads`, `/meeting/uploads` to `:3000` (the `/meeting/*` rules strip the prefix). If local API calls return HTML instead of JSON, suspect the proxy mapping.

### Auth & SSO
`controllers/authController.ts` + `routes/auth.ts`. Local login is username (email) + plaintext `password`; `is_admin` gates admin actions (returned as `!!is_admin`). Also supports **OIDC/Keycloak SSO** (`services/oidcService.ts`, `users.keycloak_sub`, auto-redirect for unauthenticated users) and password reset over SMTP (nodemailer). Admin user management (`PUT /api/auth/users/:id`) can change team, display name, and username.

### MCP server (in-app)
`backend/src/mcp/server.ts` (`mountMcp`) exposes a Model Context Protocol endpoint at **`/mcp`** with permissive CORS. Personal tokens (`routes/tokens.ts`, `services/tokenService.ts`) grant read+write; a shared `MCP_TOKEN` is read-only. This is separate from the `.mcp.json` dev tool below.

### Report → final_report merge
Two paths produce `final_reports`:
- `services/workflow.ts` — a LangGraph StateGraph (`collectReports → groupByTeam → analyzeReports → generateFinalReport → saveFinalReport`).
- `services/mergeService.ts` — groups reports by `(report_date, department_id, tag_signature)` and upserts via `INSERT … ON CONFLICT (report_date, department_id, tag_signature) DO UPDATE`. The `final_reports` unique key is that triple.

`services/aiService.ts` calls Claude (`claude-sonnet-4-6`) via `@anthropic-ai/sdk`. Prompts load from `backend/src/prompts/*.md` (`merge.md`, `polish-guide.md`, `team.md`) at module init via `fs.readFileSync` — the **Dockerfile copies these to `dist/prompts` because `tsc` does not** (`cp -r backend/src/prompts backend/dist/prompts`). If you add a prompt, update that copy step.

### RAG
`services/ragService.ts` chunks report text and writes vectors to `document_embeddings` (pgvector, 1536-dim). **`generateEmbedding` uses a local deterministic hash (`generateLocalEmbedding`), not an external embedding API** — don't assume real semantic embeddings. Embedding runs as a background promise after merge; failures are logged, not surfaced.

### Tiptap editor + image upload
The editor pastes images via a custom Tiptap extension (`frontend/src/extensions/clipboardImagePaste.ts`) that POSTs to `/api/images` and inserts the returned `/uploads/...` URL (see `tiptap-clipboard-image-paste.md`). `uploads/` is a mounted PVC in k8s (`meeting-notes-uploads-pvc`) — not shared pod storage.

## Environment & secrets

Backend reads `process.env` (via `dotenv` in dev, k8s Secret `meeting-notes-secret` in prod):
- `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` (see Two databases) / `PGSSLMODE`
- `CLAUDE_API_KEY`
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` (nodemailer)
- OIDC/Keycloak settings (issuer/client id/secret/redirect) consumed by `oidcService.ts`
- `MCP_TOKEN` (shared read-only MCP token), `PORT` (default 3000), `NODE_ENV`, `EXTERNAL_URL`

`backend/.env` is gitignored. README/`feat.md` example connection strings are not reliably current.

## MCP (dev tooling)

`.mcp.json` registers an `agent-meeting-mcp` jbang JDBC server (`jdbc@quarkiverse/quarkus-mcp-servers`) pointed at `jdbc:postgresql://172.10.65.80:30432/meeting_notes` — use it for direct SQL against the live DB during development. (Distinct from the in-app `/mcp` endpoint above.)

## Conventions

- Comments and user-facing strings are in **Korean** — match the existing language when editing.
- TypeScript everywhere; `tsc` for backend, `vue-tsc` for frontend. `strict: true`.
- No test framework is configured — there are no `test` scripts.
