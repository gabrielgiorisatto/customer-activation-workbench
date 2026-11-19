# Customer Activation Workbench

[Public prototype](https://customer-activation-workbench.breathtakingboot32.chatgpt.site) · [Public source](https://github.com/gabrielgiorisatto/customer-activation-workbench)

The head of Customer Success buys the workbench. An onboarding manager uses it to decide where to spend two intervention slots and establish whether a customer can use the invoice approval workflow. The workbench replaces the shared checklist as the source for onboarding decisions. A milestone records activity. First value requires a representative invoice reference, the approving finance owner, the approval date, and a description of the agreed workflow used.

## Reviewer walkthrough

The fixed demo date is **November 19, 2026**. The six starting accounts are fictional. An onboarding start of November 5 is a sample assumption.

1. Open **Epsilon**. It is five days overdue, with an unassigned account owner, no recorded milestones and an unknown cause. Try saving an intervention without an action owner. Then enter a next action such as “Investigate the handoff and identify the finance owner,” assign it to the onboarding manager, and follow up on November 20. Reload and check the plan and the remaining unverified first value.
2. Compare **Alpha** and **Beta**. Alpha is due in three days and its mapping blocker can be addressed by an internal specialist. Beta is due in two days and needs a customer-provided policy. Check Beta’s policy milestone and see that the dependency remains open. A resolution requires recording confirmation from the responsible party.
3. Open **Gamma**. It already shows verified approval from November 18. Compare **Zeta**, which is due tomorrow and needs agreement on the representative workflow, and **Delta**, which has scheduled setup and no active blocker.
4. Return to **Epsilon**. Submit first value without evidence and check validation. Then record a fictional invoice reference, finance owner, approval date of November 19, and a description of the agreed approval. Confirm the account moves to Activated and frees its slot. Try the Activated filter. To see an empty state, record a fictional confirmation that resolves Beta's policy dependency and filter by Waiting on customer.

## Decision rules

An overdue account with no intervention and a dependency that is not exclusively customer-owned gets first priority. An internal blocker due within three days comes next, followed by other open internal, joint or unknown blockers. Ties use target date and then account name. Customer-owned dependencies stay visible for follow-up while the workbench recommends accounts with more direct intervention options. Zeta can become the next recommendation when a slot opens.

The manager can override the recommendation by planning an intervention for any unverified account. Each Monday–Sunday week can hold two active plans, counted by follow-up date. The dashboard shows capacity for the week of the demo reference date and lists other weeks separately. A plan can be edited or released. Confirming first value releases capacity and leaves the record intact. An action owner is distinct from the account owner. Proof of first value needs a valid date from onboarding start to the demo date. Recorded open workflow dependencies must be resolved before verification. Resolution relies on the manager’s record of the confirmation.

The trade-off is that the workbench prioritizes an actionable internal fix over some closer deadlines. The ranking is a deterministic scheduling rule.

## Proposed metric

**Time to verified first value** is the elapsed calendar days from recorded onboarding start to the date of the recorded, verified invoice approval. Report the median for verified accounts alongside the count and age of unverified accounts in the same cohort, so stalled accounts remain visible. Completed task count misses whether a finance owner got an invoice through the agreed process. The demo makes no claim about actual customer outcomes or savings.

## Run locally

Requires Node 24 and npm. No cloud account or credentials are needed for development.

```sh
npm ci
npm run dev
npm test
npm run build
```

The development server implements the same API using Node's SQLite module and the checked-in migration. Production runs a Cloudflare Worker with Sites-managed D1. The build embeds the Vite assets in the Worker and packages the SQL migration. React and Tailwind render the workbench, and TypeScript domain rules drive both UI explanations and server-side validation. A versioned write prevents one browser tab from silently overwriting a concurrent change. A random HTTP-only cookie isolates each visitor’s demo records. Changes survive reload but the cookie is scoped to one browser and expires after 30 days.

## Verification and ownership

Vitest covers the initial ranking and date boundaries, missing action owner and past follow-up, the two-slot cap, activation evidence requirements, Beta’s dependency after a milestone update, and persistence and session isolation using real SQLite. The production build checks application types and bundles the frontend and Worker. The walkthrough above is a reproducible manual checklist.

The exercise brief, core flow, and technology requirements were supplied by Gabriel. Codex used them to implement the UI, rules, database and verification. The written walkthrough and tests are available for Gabriel to reproduce independently.

The demo uses typed attestations as evidence. It has no invoice engine, CRM, messaging, authentication, team sharing, or production-grade storage cleanup. The latest blocker replaces the previous blocker when a new one is recorded. A production next step would be an audit history and explicit retention. Screen-reader coverage and load testing are outside the verification performed here.

## Data explorer

Open **Data explorer** at `/data` to inspect the current demo session. The page loads account data from the same API as the workbench and builds an in-memory SQLite snapshot with six tables. The `activity_history` table exposes saved account events, including the timestamp in UTC. Queries execute in the browser and return up to 100 rows. **Refresh data** fetches a new snapshot. To restore the original seed, choose **Reset demo data** and confirm. The server removes saved changes for that session only.

## Managing your own accounts

Use **New account** to enter the name, desired outcome, onboarding start, target date and optional owner. Start with the invoice-approval milestones or an empty list. On an account, **Edit account** updates its details while preserving its blocker, intervention, milestones and approval evidence. **Add milestone** offers editable suggestions or a custom name, and **Edit** renames an existing milestone while preserving completion. Milestone completion tracks activity. The finance owner's representative invoice approval is verified in **First value milestone**. The demo reference date and two-intervention limit apply to the whole portfolio. Reset restores the six seeded examples and discards custom accounts in that session.

## Activity history

Each account shows its latest 20 recorded changes. Activity begins with changes made after this feature was introduced. The server saves the activity entry and the account update together. Timestamps reflect when an update was saved, in UTC. Resetting the demo clears the session's activity along with its other saved changes.

When changing the persisted data model or database schema, update the Data explorer snapshot and its tests in the same change. Expose the new fields and relationships for the current session.
