import { Activity, BookOpen, CheckCircle2 } from 'lucide-react'
import SiteNav from '../shell/SiteNav.tsx'
import { capacity } from '@domain/index.ts'

const walkthrough = [
  { title: 'Inspect an account', detail: 'Open Epsilon in the Account queue. The target is overdue, the account owner is unassigned, and the cause of the delay is unknown. The status explanation shows what needs attention.' },
  { title: 'Plan an intervention', detail: 'Choose Plan intervention. Record the next action, who owns it, and when to follow up. Try saving without an owner to see the validation. A saved plan appears in the weekly list and survives a reload.' },
  { title: 'Check a dependency', detail: 'Open Beta and complete the approval policy milestone. Beta still waits on the customer. Use Record resolution when you have confirmation that the finance lead provided the policy.' },
  { title: 'Verify first value', detail: 'Open Gamma to see an existing approval record. To try the workflow yourself, open Epsilon and choose Confirm first value. Record a sample invoice reference, finance owner, approval date, and how the agreed workflow was used.' },
]

export default function Guide() {
  return <>
    <header className="topbar"><div className="shell topbar-inner">
      <div className="brand"><span className="brand-icon"><Activity size={20} /></span> Activation Workbench</div>
      <SiteNav current="/guide" />
    </div></header>
    <main className="shell pb-10">
      <div className="intro">
        <div className="context"><BookOpen size={16} /> Reviewer guide</div>
        <h1>How the workbench works</h1>
        <p>You manage six onboarding accounts and have time to intervene in {capacity} this week. See where your team can help and which accounts have reached first value.</p>
        <a className="primary w-fit" href="/">Open the workbench</a>
      </div>

      <section className="panel explorer-panel mb-4" aria-labelledby="value-heading">
        <h2 id="value-heading" className="flex items-center gap-2"><CheckCircle2 className="text-brand" size={20} /> What counts as first value?</h2>
        <p>The customer’s finance owner approves a representative invoice through the agreed workflow. Setup, data imports, and training are milestones that track readiness. The approval record verifies the result.</p>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <section className="panel explorer-panel" aria-labelledby="walkthrough-heading">
          <h2 id="walkthrough-heading">Try the workflow</h2>
          <ol className="grid gap-4">
            {walkthrough.map(({ title, detail }, index) => <li key={title} className="grid grid-cols-[auto_1fr] items-start gap-3">
              <span className="section-icon" aria-hidden="true">{index + 1}</span>
              <div><h3>{title}</h3><p className="mt-1">{detail}</p></div>
            </li>)}
          </ol>
        </section>

        <div className="grid gap-4">
          <section className="panel explorer-panel" aria-labelledby="priority-heading">
            <h2 id="priority-heading">Why Epsilon and Alpha first?</h2>
            <dl className="grid gap-3">
              <div><dt className="font-semibold text-ink">Epsilon</dt><dd className="font-normal text-muted">Five days overdue with no owner or next action. Assign someone to investigate what is holding it up.</dd></div>
              <div><dt className="font-semibold text-ink">Alpha</dt><dd className="font-normal text-muted">Due in three days. An internal specialist can fix the sample-data mapping issue.</dd></div>
              <div><dt className="font-semibold text-ink">Beta</dt><dd className="font-normal text-muted">Due sooner than Alpha. Progress depends on the finance lead providing the approval policy.</dd></div>
            </dl>
            <p>The recommendations put overdue accounts without a plan first when the team can act or investigate. Internal blockers due within three days come next, followed by other blockers the team can help coordinate. Ties use the target date, then the account name. You can choose where to use each slot.</p>
          </section>
          <section className="panel explorer-panel" aria-labelledby="slots-heading">
            <h2 id="slots-heading">How weekly capacity works</h2>
            <p>Each active plan uses one of {capacity} slots in the Monday–Sunday week of its follow-up date. A plan for next week stays visible under other weeks. Releasing a plan or verifying first value frees its slot.</p>
          </section>
        </div>
      </div>

      <section className="panel explorer-panel mt-4" aria-labelledby="metric-heading">
        <h2 id="metric-heading">How to measure success</h2>
        <p>Track calendar days from onboarding start to the recorded date of a verified approval. Pair the median with the count and age of accounts still waiting for first value so stalled accounts stay visible.</p>
      </section>
      <footer>Fictional data. Resolutions and evidence are typed demo records, not live customer messages. Reset in Data explorer restores seed accounts.</footer>
    </main>
  </>
}
