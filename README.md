# Customer Activation Workbench

[Live demo](https://customer-activation-workbench.onrender.com/) · [Repository](https://github.com/gabrielgiorisatto/customer-activation-workbench)

Prototype for an onboarding manager: prioritize two interventions per week and record when finance approves a representative invoice through the agreed workflow (first value). Demo date: **19 Nov 2026**. Six seed accounts, fictional data.

## Stack

React 19 + Tailwind + Vite (`client/`). Express (`server/`) serves the API and static build. Business rules live in `domain/` and run on both client and server. Sessions persist in SQLite (`node:sqlite`); each browser gets an HTTP-only cookie. Vitest. Deploy: Render Web Service ([`render.yaml`](render.yaml), build `npm ci --include=dev && npm run build`, start `npm start`). No Postgres.

API updates use account `id` (`PATCH /api/accounts/:id`). Seed UUIDs are in `domain/seed-ids.ts`. Display names stay unique in the portfolio.

```sh
npm ci && npm run dev   # localhost:5173
npm test
npm run build && npm start
```

On Render, reload keeps session data until redeploy or the free tier idles out.

## Walkthrough for reviewers

1. **Epsilon** — overdue, no owner. Save an intervention without action owner (should fail). Plan an action with owner and follow-up 20 Nov; reload and confirm it stuck.
2. **Alpha / Beta** — internal blocker vs customer policy. On Beta, check a milestone without resolving the policy dependency.
3. **Gamma** — already activated. **Zeta** / **Delta** — blocked vs in progress.
4. **Epsilon** — verify without evidence (fail), then with invoice, approver, date, workflow (Activated, slot freed). Try filters. Resolve Beta’s blocker and filter **Waiting on customer** for empty state.

More detail: `/guide`. Session SQL snapshot: `/data`.

## Rules (implemented)

- Priority: overdue accounts you can act on first; internal blockers due in ≤3 days next; then other non-customer blockers; tie-break by target date, then name.
- Two intervention slots per week (Mon–Sun), by follow-up date. Release plan or verify first value to free a slot.
- Activation needs evidence; open blockers must be resolved first. Milestones track activity, not first value.

Proposed metric: median days from onboarding start to verified approval, plus count of accounts still unverified.

## Tests

`npm test` — ranking, validation, weekly slots, activation, session isolation, explorer SQL (`domain/`, `server/`, `client/`).

Not built: real invoice/CRM, auth, shared multi-user storage, ML scoring.