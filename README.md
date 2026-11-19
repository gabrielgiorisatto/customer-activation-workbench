# Customer Activation Workbench

[Live demo](https://customer-activation-workbench.onrender.com/) · [Repository](https://github.com/gabrielgiorisatto/customer-activation-workbench)

Head of Customer Success buys it; onboarding managers use it. They pick up to two interventions per week and record first value: finance approved a representative invoice through the agreed workflow—not just checklist completion. Replaces a shared checklist that hides stalled outcomes. Demo date **19 Nov 2026**; synthetic data.

## Stack

React, Tailwind, Vite (`client/`). Express + SQLite sessions per cookie (`server/`). Rules in `domain/` (UI + API). Vitest. Render deploy: [`render.yaml`](render.yaml) — `npm ci --include=dev && npm run build`, `npm start`. Account updates: `PATCH /api/accounts/:id` (seed IDs in `domain/seed-ids.ts`).

```sh
npm ci && npm run dev
npm test
npm run build && npm start
```

Reload keeps the session on the same instance; Render free tier may wipe data after redeploy or idle sleep.

## Trade-off

Auto-recommendations prefer overdue work the team can act on and internal blockers due within three days over closer customer-only deadlines (e.g. Beta vs Zeta). Any account can still be planned manually.

## Metric

Time to verified first value: onboarding start → approval date on file. Report median among verified accounts plus count of unverified in the cohort. Task counts alone do not show finance proved the workflow on a real invoice.

## Reviewer checklist

- [ ] Six accounts load on the deploy URL.
- [ ] Epsilon: missing action owner fails; valid plan persists after reload.
- [ ] Beta: marking policy milestone done does not remove customer blocker without resolution note.
- [ ] Gamma: shows evidence, status Activated.
- [ ] Alpha vs Beta: different blocker types and priority copy.
- [ ] Epsilon: verify without evidence fails; valid evidence activates and frees a slot.
- [ ] Empty filter state; resolve Beta and filter Waiting on customer.
- [ ] Optional: `/guide`, `/data` SQL explorer.

`npm test` covers ranking, slots, activation, sessions, explorer SQL.

## Out of scope / limits

No invoice engine, CRM, messaging, auth, or shared prod storage. One cookie per browser; blocker history is not versioned. No formal screen-reader or load pass. Resolutions and evidence in the UI are typed demo records.

## Next steps

Blocker audit trail, retention policy, integrations for customer-owned dependencies (still manual confirmation).

Take-home exercise; AI tools helped build it. Logic in `domain/` and tests above are how to verify—no claimed customer research or savings.