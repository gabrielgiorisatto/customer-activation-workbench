# Customer Activation Workbench

[Live demo](https://customer-activation-workbench.onrender.com/) · [Repository](https://github.com/gabrielgiorisatto/customer-activation-workbench)

Submission for the Customer Activation workbench exercise. Product scenario and acceptance criteria are in the original brief; this file describes **how this repository implements and runs it**.

## What runs

Single Node app: Express serves the React build and a small JSON API. Business rules live in `domain/` and are imported by both the client (labels, ranking on screen) and the server (validation on write). Session state is a JSON blob per browser in SQLite, keyed by an HTTP-only cookie. Demo fixture date: **2026-11-19**.

| Path | Purpose |
|------|---------|
| `/` | Workbench — queue, recommendations, account detail, dialogs |
| `/guide` | Short in-app notes for reviewers |
| `/data` | Read-only SQL over an in-memory snapshot of the current session |

Account API: `GET /api/accounts`, `PATCH /api/accounts/:id`, `POST /api/accounts`, `POST /api/reset`. Stable seed UUIDs in [`domain/seed-ids.ts`](domain/seed-ids.ts).

## Layout

- **`domain/`** — `applyChange`, priority, slots, activation checks, seed data  
- **`server/src/`** — `sessions.ts` (request handler), `app.ts` (Express), `sqlite-store.ts`, `index.ts` (dev: Vite middleware; prod: static `client/dist`)  
- **`client/src/`** — feature folders (`workbench`, `accounts`, `explorer`, `guide`, `shell`), `api/accounts.ts`

Optimistic concurrency on save: `revision` column, up to three retries on `409`.

## Local and deploy

Node 24, npm.

```sh
npm ci && npm run dev   # http://localhost:5173
npm test
npm run build && npm start
```

**Render** (Web Service, no Postgres): [`render.yaml`](render.yaml). Build must use `npm ci --include=dev && npm run build` so Vite/TypeScript install. Session file may reset on redeploy or free-tier sleep; reload still tests persistence on a warm instance.

## Verification

**Automated:** `npm test` — ranking, validation, weekly slot cap, Beta blocker vs milestone, session isolation, explorer SQL guards.

**Manual on the live URL** (maps to the brief’s scenarios, not repeated here):

- Validation, reload, filters / empty state, Alpha–Epsilon paths in the reviewer checklist from the exercise  
- `/guide` for rule copy wired from the same `domain` constants

## Not implemented here

No Worker/D1 (Render-only deploy), no auth, no external integrations. Evidence and blocker resolutions are form fields, not inbound messages. Blocker edits replace the previous record (no history table).

## Notes on authorship

Take-home build with AI-assisted coding. Behavior is defined in `domain/` and locked by the tests above.