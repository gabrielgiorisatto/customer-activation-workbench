# Customer Activation Workbench

**Repository:** https://github.com/gabrielgiorisatto/customer-activation-workbench  
**Live demo:** add your Render URL here after deploy

Onboarding managers use this app to see which customer accounts need help this week, plan up to two interventions, and record proof that finance approved a representative invoice through the agreed workflow—that’s “first value,” not just completed tasks.

Demo date in the UI: **19 Nov 2026**. Six fictional seed accounts. Data is synthetic.

---

## Stack

| Layer | Tech |
|-------|------|
| UI | React 19, Tailwind 4, Vite |
| API | Express 5, `handleRequest` + cookie session |
| Persistence | SQLite (`node:sqlite`), one row per browser session |
| Rules | Shared TypeScript in `domain/` (same logic in UI and server) |
| Tests | Vitest |

**Repo layout**

- `domain/` — types, ranking, validation, `applyChange`, seed data and fixed account UUIDs in `seed-ids.ts`
- `server/` — Express app, session API, schema
- `client/` — React pages: workbench (`/`), data explorer (`/data`), guide (`/guide`)

Accounts are keyed by **`id`** (`PATCH /api/accounts/:id`). Names are labels only and must stay unique in the portfolio.

---

## Run and deploy

**Local** (Node 24, no secrets):

```sh
npm ci
npm run dev    # http://localhost:5173 — Express + Vite + activation.sqlite
npm test
npm run build
npm start      # serves client/dist + API
```

**Render** (one Web Service, no Postgres): see [`render.yaml`](render.yaml). Build: `npm ci --include=dev && npm run build`. Start: `npm start`. Session data lives on the instance disk—it survives reload but may reset after redeploy or long idle on the free tier.

---

## Reviewer walkthrough

1. **Epsilon** — overdue, no owner. Try an intervention without action owner (validation), then plan one with owner and follow-up 20 Nov. Reload; plan should persist.
2. **Alpha vs Beta** — internal mapping blocker vs customer policy dependency. On Beta, completing a milestone must not clear the customer blocker without a resolution note.
3. **Gamma** — already activated with evidence. **Zeta** / **Delta** — contrast blocked vs in progress.
4. **Epsilon again** — try verify without evidence, then submit valid evidence (invoice, approver, date, workflow). Account becomes Activated and frees a weekly slot. Use filters; resolve Beta’s blocker to try an empty filter state.

Guide page at `/guide` summarizes priority and capacity rules.

---

## Product rules (short)

- **Recommendations:** overdue (non–customer-only blocker) first; then internal blockers due within 3 days; then other internal/joint/unknown; tie-break target date, then name. Customer-owned blockers are tracked but not auto-prioritized like internal fixes.
- **Capacity:** two active interventions per calendar week (Monday–Sunday), by follow-up date. Override by planning any account.
- **Activation:** evidence required; open blockers must be resolved first. Marking a milestone done does not satisfy a customer dependency (e.g. Beta policy).

**Metric (proposed):** median days from onboarding start to verified approval date; report alongside count of unverified accounts.

---

## Tests and scope

`npm test` checks ranking, validation, two-slot weeks, activation rules, SQLite session isolation, and read-only explorer SQL. Tests sit next to code in `domain/`, `server/`, and `client/`.

**In scope:** demo workflow, reload persistence per browser cookie, basic a11y on controls.

**Out of scope:** real invoice/CRM integrations, auth, multi-user prod storage, predictive ML.

Built for a timed product exercise; AI tools assisted implementation—logic, walkthrough, and tests are in this repo for independent review.