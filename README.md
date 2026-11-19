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

## Logic decisions

Single source: [`domain/rules.ts`](domain/rules.ts), [`domain/apply-change.ts`](domain/apply-change.ts). Constants: `demoDay` = 2026-11-19, `capacity` = 2 intervention slots per week.

### Status labels (queue filters)

Drives the filter dropdown and pills; distinct from recommendation order.

1. **Activated** — evidence on file passes validation (invoice, approver, workflow, approval date between onboarding start and demo day).
2. Else if open blocker (no resolution): **Waiting on customer** when party is Customer; otherwise **Blocked** (Internal, Joint, Unknown).
3. Else if target date before demo day: **Needs attention** (overdue, still unverified).
4. Else **In progress**.

Milestones changing to “done” does not clear a blocker or activate an account.

### Priority rank (`priority()`)

Lower rank = more urgent for sorting the account queue. Used for labels on each account, not only recommendations.

| Rank | When | Label |
|------|------|--------|
| 0 | Target passed, open dependency is not Customer-only | Urgent |
| 1 | Internal blocker and target within 3 days of demo day | Internal unblock |
| 2 | Open Joint/Unknown blocker (not Customer-only) | Needs coordination |
| 6 | No open blocker | Monitor |
| 7 | Open Customer blocker | Customer-owned |
| 8 | Active intervention (action set, not activated) | Intervention planned |
| 9 | Activated | Verified |

**Overdue + customer-only blocker** does not get rank 0; those accounts stay Customer-owned (7) so the UI still shows follow-up, but they are not treated as “the team can unblock this now.”

### Recommended interventions (`recommendations()`)

Automated picks above the queue:

- Candidate pool: accounts with `priority().rank <= 2` only (Urgent, Internal unblock, Needs coordination).
- Sort: rank ascending, then target date, then account name.
- Count cap: `capacity` minus interventions already planned in the **same ISO week as demo day** (Monday–Sunday UTC, based on follow-up date, not target date).
- Accounts that already have a plan (rank 8) drop out of the pool because their rank is > 2.
- Manager can still plan any account manually; recommendations are a default, not a lock.

**Why this ordering:** rank 0 catches overdue accounts where the onboarding team can still act (Epsilon before customer-bound Beta). Rank 1 surfaces Alpha-style internal fixes before the target window closes. Customer-owned work (Beta) stays visible in the queue at rank 7 but is not auto-suggested when slots are scarce—tests assert Epsilon + Alpha in the initial pick, not Beta.

### Intervention capacity

- A plan counts toward the week of its **follow-up** date (`interventionWeek()`).
- At most two active (non-activated) plans per week; saving a third returns validation on follow-up.
- Follow-up must be demo day or later (fixture: no backdated plans).
- Releasing a plan or verifying first value frees a slot in that follow-up week.

### First value (activation)

- Server and client both call `applyChange`; evidence rules in `evidenceErrors()`.
- Cannot verify while an open blocker exists (resolution note required first).
- Milestone completion alone never sets activated.

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