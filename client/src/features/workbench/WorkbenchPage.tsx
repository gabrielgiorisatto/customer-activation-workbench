import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Activity, AlertCircle, CalendarDays, Check, Circle, Crosshair, Layers3, ListFilter, Plus, Users, X } from 'lucide-react'
import { accountKey, activated, capacity, dateLabel, deadline, demoDay, explainStatus, interventionWeek, priority, recommendations, status, weekStart, type Account, type Change, type Party } from '@domain/index.ts'
import { loadAccounts, updateAccount } from '../../api/accounts.ts'
import SiteNav from '../shell/SiteNav.tsx'
import AccountEditor, { type AccountEditorMode } from '../accounts/AccountEditor.tsx'

const filters = ['All accounts', 'Needs attention', 'Blocked', 'Waiting on customer', 'In progress', 'Activated'] as const
type Filter = typeof filters[number]
type Editor = 'action' | 'blocker' | 'resolve' | 'verify'

function Chip({ children, tone = '' }: { children: ReactNode; tone?: string }) {
  return <span className={`chip ${tone}`}>{children}</span>
}

function StatusPill({ account }: { account: Account }) {
  const state = explainStatus(account)
  return <Chip tone={state.tone}>{state.label}</Chip>
}

export default function WorkbenchPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState<Filter>('All accounts')
  const [selection, setSelection] = useState('')
  const [accountEditor, setAccountEditor] = useState<AccountEditorMode>()
  const [editor, setEditor] = useState<Editor>()
  const [notice, setNotice] = useState('')
  const [inlineError, setInlineError] = useState('')
  const [busy, setBusy] = useState(false)
  const focusOnDetail = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)

  async function reload() {
    setLoading(true)
    setLoadError('')
    try { setAccounts(await loadAccounts()) }
    catch { setLoadError('Could not load the demo. Please try again.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void reload() }, [])
  useEffect(() => {
    if (focusOnDetail.current) {
      heading.current?.focus()
      focusOnDetail.current = false
    }
  }, [selection])

  const picks = recommendations(accounts)
  const currentWeek = weekStart(demoDay)
  const activePlans = accounts.flatMap(account => account.action && !activated(account) ? [{ account, action: account.action }] : [])
    .sort((a, b) => a.action.followUp.localeCompare(b.action.followUp) || a.account.name.localeCompare(b.account.name))
  const planned = activePlans.filter(({ account }) => interventionWeek(account) === currentWeek)
  const outsideWeek = activePlans.filter(({ account }) => interventionWeek(account) !== currentWeek)
  const verifiedCount = accounts.filter(activated).length
  const order = (a: Account, b: Account) => priority(a).rank - priority(b).rank
    || a.target.localeCompare(b.target) || a.name.localeCompare(b.name)
  const visible = accounts.filter(account => {
    if (filter === 'All accounts') return true
    return status(account) === filter
  }).sort(order)
  const selected = visible.find(account => accountKey(account) === selection) ?? visible[0]

  function select(name: string, fromRecommendation = false) {
    if (fromRecommendation) setFilter('All accounts')
    if (name !== selection) focusOnDetail.current = true
    else heading.current?.focus()
    setSelection(name)
    setNotice('')
    setInlineError('')
  }

  async function save(change: Change, message: string): Promise<Record<string, string>> {
    if (!selected && change.type !== 'create') return { form: 'Select an account first.' }
    setBusy(true)
    setInlineError('')
    try {
      const key = selected ? accountKey(selected) : ''
      const result = await updateAccount(key, change)
      if (result.errors) return result.errors
      if (!result.accounts) return { form: 'Could not save the change. Try again.' }
      if (change.type === 'verify' || change.type === 'create') setFilter('All accounts')
      const updatedKey = result.createdId ?? key
      const updated = result.accounts.find(account => accountKey(account) === updatedKey)
      focusOnDetail.current = change.type === 'create'
      setSelection(updatedKey)
      setAccounts(result.accounts)
      setNotice(updated ? `${updated.name}: ${message}` : message)
      return {}
    } catch {
      return { form: 'Could not save the change. Try again.' }
    } finally { setBusy(false) }
  }

  async function saveInline(change: Change, message: string) {
    const errors = await save(change, message)
    setInlineError(Object.values(errors)[0] ?? '')
  }

  return <>
    <header className="topbar">
      <div className="shell topbar-inner">
        <div className="brand"><span className="brand-icon"><Activity size={20} /></span> Activation Workbench</div>
        <SiteNav current="/" /><span className="demo"><CalendarDays size={15} /> Demo date · Nov 19, 2026</span>
      </div>
    </header>
    <main className="shell">
      <div className="intro">
        <div className="context"><Layers3 size={16} /> Customer Success / Onboarding</div>
        <h1>Customer activation</h1>
        <p>Prioritize interventions and verify when each account reaches first value.</p>
      </div>

      {loading && <p role="status" className="panel message">Loading accounts…</p>}
      {loadError && <div className="panel message" role="alert">{loadError} <button className="secondary" onClick={reload}>Retry</button></div>}
      {!loading && !loadError && <>
        <section className="stats" aria-label="Portfolio summary">
          <Summary label="Onboarding accounts" value={accounts.length} icon={<Users size={19} />} note="In this portfolio" />
          <Summary label="First value verified" value={verifiedCount} icon={<Check size={19} />} note={`of ${accounts.length} accounts`} />
          <Summary label="Intervention slots" value={`${planned.length} / ${capacity}`} icon={<Crosshair size={19} />} note="Planned this week" />
        </section>
        <section className="focus panel" aria-labelledby="planned-title">
          <div className="focus-title"><div className="section-icon"><CalendarDays size={19} /></div><div>
            <h2 id="planned-title">Planned interventions this week</h2>
            <p>{planned.length} of {capacity} slots in use</p>
          </div></div>
          <PlanList plans={planned} busy={busy} onSelect={key => select(key, true)} />
          {outsideWeek.length > 0 && <div className="mt-4 grid gap-2">
            <h3>Interventions scheduled for other weeks</h3>
            <PlanList plans={outsideWeek} busy={busy} onSelect={key => select(key, true)} />
          </div>}
        </section>
        <section className="focus panel" aria-labelledby="focus-title">
          <div className="focus-title"><div className="section-icon"><Crosshair size={19} /></div><div>
            <h2 id="focus-title">Recommended interventions</h2>
            <p>Start with overdue accounts that lack a plan, then prioritize internal blockers due within three days.</p>
          </div></div>
          {picks.length ? <div className="picks">{picks.map(account =>
            <button key={accountKey(account)} className="pick" onClick={() => select(accountKey(account), true)}>
              <span className="pick-top"><strong>{account.name}</strong><Chip tone={priority(account).rank === 0 ? 'red' : 'blue'}>{priority(account).label}</Chip></span>
              <span>{priority(account).reason}</span>
            </button>)}</div>
            : <p>{planned.length === capacity ? 'Both slots are in use. The scheduled interventions are listed above.' : 'No additional accounts meet the intervention rules.'}</p>}
        </section>

        <div className="workspace">
          <section className="panel queue" aria-labelledby="queue-title">
            <div className="queue-header">
              <div className="section-heading"><h2 id="queue-title">Account queue</h2><button className="primary" disabled={busy} onClick={() => setAccountEditor({ type: 'create' })}><Plus size={16} /> New account</button></div>
              <label className="filter"><ListFilter size={17} /><span className="sr-only">Filter accounts</span>
                <select value={filter} onChange={event => { setFilter(event.target.value as Filter); setNotice(''); setInlineError('') }}>
                  {filters.map(item => <option key={item}>{item}</option>)}
                </select>
              </label>
              <p className="text-sm">{visible.length} of {accounts.length} accounts</p>
            </div>
            {visible.length ? <ul className="account-list">{visible.map(account =>
              <li key={accountKey(account)}><button className="account-row" aria-current={account === selected ? 'true' : undefined} onClick={() => select(accountKey(account))}>
                <span className="account-mark">{account.name[0]}</span>
                <span className="row-text"><strong>{account.name}</strong><span>{activated(account) && account.evidence ? `Verified ${dateLabel(account.evidence.date)}` : deadline(account)}</span></span>
                <StatusPill account={account} />
              </button></li>
            )}</ul> : <div className="message"><strong>No matching accounts</strong><p>Try a different filter to see more accounts.</p><button className="secondary" onClick={() => setFilter('All accounts')}>Show all accounts</button></div>}
          </section>

          {selected && <section className="panel detail" aria-labelledby="account-title">
            <div className="detail-head">
              <div>
                <div className="detail-title">
                  <h2 tabIndex={-1} ref={heading} id="account-title">{selected.name}</h2>
                  <StatusPill account={selected} />
                </div>
                <p className="detail-meta">Target {dateLabel(selected.target)} · {deadline(selected)} · Started {dateLabel(selected.started)} · Owner {selected.owner || 'Unassigned'}</p>
              </div>
              <button className="text-button" disabled={busy} onClick={() => setAccountEditor({ type: 'details', account: selected })}>Edit account</button>
            </div>
            <div className="detail-content">
              {notice && <div className="notice" role="status"><Check size={17} />{notice}</div>}
              {inlineError && <p className="error" role="alert">{inlineError}</p>}

              <section className={`decision ${!activated(selected) && priority(selected).rank === 0 ? 'urgent' : ''}`} aria-label="What to do next">
                <div className="section-heading">
                  <p className="decision-lead">{activated(selected) ? explainStatus(selected)?.reason : priority(selected).reason}</p>
                  {!activated(selected) && <button className="primary" disabled={busy} onClick={() => setEditor('action')}>{selected.action ? 'Edit intervention' : <><Plus size={16} /> Plan intervention</>}</button>}
                </div>
                {selected.action && !activated(selected) && <div className="planned">
                  <strong>{selected.action.description}</strong>
                  <p>Owner: {selected.action.owner} · Follow-up: {dateLabel(selected.action.followUp)}</p>
                  <button className="text-button" disabled={busy} onClick={() => saveInline({ type: 'release' }, 'Intervention slot released.')}>Release slot</button>
                </div>}
              </section>

              <section className="detail-section">
                <div className="section-heading"><h3>Milestones</h3><button className="text-button" disabled={busy} onClick={() => setAccountEditor({ type: 'milestone' })}><Plus size={16} /> Add milestone</button></div>
                <p>Setup work only. Invoice approval is recorded under First value.</p>
                {selected.milestones.length ? <ul className="milestones">{selected.milestones.map((item, index) =>
                  <li key={item.name} className="section-heading"><label><input type="checkbox" checked={item.done} disabled={busy}
                    onChange={event => saveInline({ type: 'milestone', index, expected: item.name, done: event.target.checked }, 'Milestone updated.')} /> {item.name}</label>
                    <button className="text-button" aria-label={`Edit milestone: ${item.name}`} disabled={busy} onClick={() => setAccountEditor({ type: 'milestone', previous: item.name })}>Edit</button>
                  </li>)}</ul>
                  : <p>No milestones yet.</p>}
              </section>

              <section className="detail-section">
                <div className="section-heading"><h3>Blocker</h3>
                  <button className="text-button" disabled={busy} onClick={() => setEditor('blocker')}>{selected.blocker && !selected.blocker.resolution ? 'Edit blocker' : 'Record blocker'}</button>
                </div>
                {selected.blocker ? <>
                  <p>{selected.blocker.description}</p>
                  <p><strong>{selected.blocker.party}</strong> · {selected.blocker.owner || 'Owner unknown'}</p>
                  {selected.blocker.resolution ? <p className="resolved"><Check size={16} /> Resolved · {selected.blocker.resolution}</p>
                    : <button className="secondary" disabled={busy} onClick={() => setEditor('resolve')}>Record resolution</button>}
                </> : <p>No blocker recorded.</p>}
              </section>

              <section className="detail-section">
                <div className="section-heading"><h3>First value</h3>
                  {activated(selected) ? <Chip tone="green"><Check size={14} /> Verified</Chip>
                    : <Chip>Pending</Chip>}
                </div>
                <p>{selected.outcome}</p>
                {activated(selected) && selected.evidence ? <>
                  <p><strong>{selected.evidence.invoice}</strong> · {selected.evidence.approver} · {dateLabel(selected.evidence.date)}</p>
                  <p>{selected.evidence.workflow}</p>
                </> : <>
                  <p className="evidence-empty"><Circle size={15} /> No approval recorded yet.</p>
                  <button className="secondary" disabled={busy} onClick={() => setEditor('verify')}>Confirm first value</button>
                </>}
              </section>
              <section className="detail-section activity" aria-labelledby="activity-title">
                <h3 id="activity-title">Activity</h3>
                {selected.history?.length ? <ol className="activity-list">{selected.history.map(event =>
                    <li key={event.id}>
                      <div className="section-heading">
                        <strong>{event.title}</strong>
                        <time dateTime={event.at}>{new Intl.DateTimeFormat('en-US', {
                          dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC',
                        }).format(new Date(event.at))} UTC</time>
                      </div>
                      {event.detail && <p>{event.detail}</p>}
                    </li>)}</ol>
                  : <p>No activity yet.</p>}
              </section>
            </div>
          </section>}
        </div>
        <footer>Changes are saved to this browser’s demo session.</footer>
      </>}
    </main>
    {accountEditor && <AccountEditor mode={accountEditor} busy={busy} onClose={() => setAccountEditor(undefined)} onSave={save} />}
    {selected && editor && <EditDialog key={`${selected.name}-${editor}`} account={selected} editor={editor} busy={busy}
      onClose={() => setEditor(undefined)} onSave={save} />}
  </>
}

function PlanList({ plans, busy, onSelect }: {
  plans: { account: Account; action: NonNullable<Account['action']> }[]
  busy: boolean
  onSelect: (key: string) => void
}) {
  if (!plans.length) return <p>No interventions planned for this week.</p>
  return <div className="picks">{plans.map(({ account, action }) =>
    <button key={accountKey(account)} className="pick" disabled={busy} onClick={() => onSelect(accountKey(account))}>
      <span className="pick-top"><strong>{account.name}</strong><Chip>Follow up {dateLabel(action.followUp)}</Chip></span>
      <span className="break-words">{action.description}</span>
      <span className="text-sm">Owner: {action.owner}</span>
    </button>
  )}</div>
}

function Summary({ label, value, note, icon }: { label: string; value: string | number; note: string; icon: ReactNode }) {
  return <div className="panel summary"><div className="section-heading"><span>{label}</span><span className="section-icon">{icon}</span></div>
    <div className="metric"><strong>{value}</strong><span>{note}</span></div>
  </div>
}

function EditDialog({ account, editor, busy, onClose, onSave }: {
  account: Account; editor: Editor; busy: boolean; onClose: () => void
  onSave: (change: Change, message: string) => Promise<Record<string, string>>
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  useEffect(() => { dialog.current?.showModal() }, [])
  const title = {
    action: account.action ? 'Edit intervention' : 'Plan intervention',
    blocker: 'Record dependency', resolve: 'Record resolution', verify: 'Confirm first value',
  }[editor]
  const field = (key: string, label: string, initial = '', type = 'text') => {
    const props = { id: key, name: key, defaultValue: initial, 'aria-invalid': Boolean(errors[key]),
      'aria-describedby': errors[key] ? key + '-error' : undefined, required: true, maxLength: 2000 }
    return <div className="field"><label htmlFor={key}>{label}</label>
      {type === 'textarea' ? <textarea {...props} rows={3} /> : <input {...props} type={type} />}
      {errors[key] && <span className="error" id={key + '-error'}>{errors[key]}</span>}
    </div>
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    const values = new FormData(form)
    const value = (name: string) => String(values.get(name) ?? '')
    const changes: Record<Editor, [Change, string]> = {
      action: [{ type: 'action', value: { description: value('description'), owner: value('owner'), followUp: value('followUp') } }, 'Intervention saved.'],
      blocker: [{ type: 'blocker', value: { description: value('description'), owner: value('owner'), party: value('party') as Party } }, 'Dependency recorded.'],
      resolve: [{ type: 'resolve', note: value('note') }, 'Blocker resolved.'],
      verify: [{ type: 'verify', value: { invoice: value('invoice'), approver: value('approver'), date: value('date'), workflow: value('workflow') } }, 'First value verified.'],
    }
    const result = await onSave(...changes[editor])
    if (!Object.keys(result).length) {
      dialog.current?.close()
      onClose()
    } else {
      setErrors(result)
      const firstField = form.elements.namedItem(Object.keys(result)[0])
      if (firstField instanceof HTMLElement) firstField.focus()
    }
  }

  return <dialog ref={dialog} onCancel={event => { if (busy) event.preventDefault(); else onClose() }} aria-labelledby="dialog-title">
    <form onSubmit={submit} noValidate>
      <div className="section-heading"><div><p className="context">{account.name}</p><h2 id="dialog-title">{title}</h2></div>
        <button type="button" className="icon-button" aria-label="Close dialog" disabled={busy} onClick={() => { dialog.current?.close(); onClose() }}><X size={20} /></button></div>
      <fieldset disabled={busy}>
        {editor === 'action' && <>
          <p>Assign an owner and set a date to check the outcome. The follow-up date determines which week uses the slot.</p>
          {field('description', 'Next action', account.action?.description, 'textarea')}
          {field('owner', 'Action owner', account.action?.owner)}
          {field('followUp', 'Follow-up date', account.action?.followUp ?? demoDay, 'date')}
        </>}
        {editor === 'blocker' && <>
          {field('description', 'Dependency or blocker', account.blocker?.resolution ? '' : account.blocker?.description, 'textarea')}
          <div className="field"><label htmlFor="party">Responsibility</label><select id="party" name="party" defaultValue={account.blocker?.resolution ? 'Unknown' : account.blocker?.party ?? 'Unknown'}>
            {['Unknown', 'Internal', 'Customer', 'Joint'].map(party => <option key={party}>{party}</option>)}
          </select></div>
          {field('owner', 'Dependency owner (leave blank if unknown)', account.blocker?.resolution ? '' : account.blocker?.owner)}
        </>}
        {editor === 'resolve' && <>
          <p>{account.blocker?.party === 'Internal' ? 'Record what the team changed to remove the blocker.' : 'Record how the responsible party confirmed that the dependency was resolved.'}</p>
          <p className="text-sm text-muted">Demo: typed note only; no customer inbox integration.</p>
          {field('note', 'Resolution evidence', '', 'textarea')}
        </>}
        {editor === 'verify' && <>
          <p>Record approval by the finance owner through the agreed workflow.</p>
          <p className="text-sm text-muted">Demo: fictional invoice and approval details.</p>
          {field('invoice', 'Representative invoice reference')}
          {field('approver', 'Approving finance owner')}
          {field('date', 'Approval date', demoDay, 'date')}
          {field('workflow', 'Agreed workflow and approval evidence', '', 'textarea')}
        </>}
      </fieldset>
      {(errors.form || Object.keys(errors).length > 0) && <p className="error" role="alert"><AlertCircle size={16} /> {errors.form ?? 'Correct the highlighted fields and try again.'}</p>}
      <div className="dialog-actions"><button type="button" className="secondary" disabled={busy} onClick={() => { dialog.current?.close(); onClose() }}>Cancel</button>
        <button type="submit" className="primary" disabled={busy}>{busy ? 'Saving…' : editor === 'action' ? 'Save intervention' : editor === 'verify' ? 'Verify first value' : 'Save update'}</button></div>
    </form>
  </dialog>
}

