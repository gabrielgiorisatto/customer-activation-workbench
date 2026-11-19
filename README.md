# Customer Activation Workbench

[Live demo](https://customer-activation-workbench.onrender.com/) · [Repository](https://github.com/gabrielgiorisatto/customer-activation-workbench)

The **buyer** is the head of Customer Success. The **user** is an onboarding manager with six new accounts and room to actively unblock **two per week**. The **outcome** is knowing who reached first value (finance approved a representative invoice through the agreed workflow), not only whether checklist tasks are done. This workbench replaces a shared checklist that marks work complete but hides stalled or unproven outcomes.

Demo date: **19 Nov 2026**. All accounts and evidence are synthetic.

## Stack and run

React 19, Tailwind, Vite (`client/`). Express (`server/`) + SQLite sessions per browser cookie. Rules in `domain/` (shared by UI and API). Vitest.

```sh
npm ci && npm run dev   # localhost:5173
npm test
npm run build && npm start
```

Public host: Render ([`render.yaml`](render.yaml) — build `npm ci --include=dev && npm run build`, start `npm start`). No Postgres. Updates use account `id` (`PATCH /api/accounts/:id`); seed IDs in `domain/seed-ids.ts`.

Reload keeps changes on the same instance; Render free tier may reset session data after redeploy or long idle.

## Product trade-off

Recommendations favor **overdue accounts the team can act on** and **internal blockers due within three days** ahead of closer targets that depend on the customer alone (e.g. Beta before Zeta). That is intentional: the manager can still plan any account manually.

## Success metric

**Time to verified first value** — calendar days from onboarding start to the date on the recorded approval evidence.

How to measure: median over verified accounts in a cohort, plus the count (and age) of unverified accounts in the same cohort so stalls stay visible. Task completion count is insufficient because it does not prove finance ran the agreed approval on a real invoice.

## Manual checklist (reviewer)

- [ ] Open deploy URL; six accounts load without setup.
- [ ] Epsilon: intervention without action owner fails; valid plan saves and survives reload.
- [ ] Beta: complete “Capture approval policy” milestone — still waiting on customer until resolution note.
- [ ] Gamma: shows verified evidence, not a generic “in progress” onboarding list item.
- [ ] Alpha vs Beta: different blocker types and priority copy on the account.
- [ ] Epsilon: verify without evidence fails; valid evidence activates and frees a weekly slot.
- [ ] Filter with no matches shows empty state; resolve Beta and filter **Waiting on customer** to see accounts drop off.
- [ ] `/guide` for rules; `/data` for read-only SQL on the session (optional).

Automated: `npm test` (ranking, slots, activation rules, session isolation, explorer SQL).

## Walkthrough (short)

1. **Epsilon** — overdue, unassigned. Validation on intervention owner; plan follow-up 20 Nov; reload.
2. **Alpha / Beta** — internal fix vs customer policy; milestone ≠ resolving customer dependency.
3. **Gamma** / **Zeta** / **Delta** — activated vs disputed workflow vs scheduled setup.
4. **Epsilon** — evidence path; filters; Beta resolution simulation.

Customer or finance “confirmations” in the app are **typed attestations for the demo**, not CRM or messaging integrations.

## Out of scope

Real invoice engine, CRM/calendar, messaging, multi-user permissions, billing, production retention/audit for blockers.

## Known limitations

- One browser session per cookie; no team sharing.
- Latest blocker overwrites the previous record (no full blocker history).
- Screen-reader pass and load testing were not part of this build.
- Render disk is not durable across redeploys.

## Next steps (production-shaped)

- Audit log for blockers, milestones, and evidence.
- Explicit retention and backup for session or account stores.
- Integrations for customer-owned dependencies (still surfaced as dependencies, not auto-marked done).

## How this was built

Take-home exercise. Implementation used AI coding tools; behavior is defined in `domain/`, covered by Vitest, and checked with the checklist above on the Render deploy. No revenue, savings, or customer research is claimed.