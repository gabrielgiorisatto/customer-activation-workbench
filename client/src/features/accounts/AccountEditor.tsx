import { useEffect, useRef, useState, type FormEvent } from 'react'
import { demoDay, invoiceOutcome, starterMilestones, suggestedMilestones, type Account, type Change } from '@domain/index.ts'

export type AccountEditorMode =
  | { type: 'create' }
  | { type: 'details'; account: Account }
  | { type: 'milestone'; previous?: string }

export default function AccountEditor({ mode, busy, onClose, onSave }: {
  mode: AccountEditorMode; busy: boolean; onClose: () => void
  onSave: (change: Change, message: string) => Promise<Record<string, string>>
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [milestone, setMilestone] = useState(mode.type === 'milestone' ? mode.previous ?? '' : '')
  const [starter, setStarter] = useState(true)
  useEffect(() => { dialog.current?.showModal() }, [])
  const account = mode.type === 'details' ? mode.account : undefined
  const title = mode.type === 'create' ? 'New account' : mode.type === 'details' ? 'Edit account' : mode.previous ? 'Edit milestone' : 'Add milestone'

  function close() {
    dialog.current?.close()
    onClose()
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    const data = new FormData(form)
    const value = (key: string) => String(data.get(key) ?? '')
    const details = { name: value('name'), owner: value('owner'), started: value('started'), target: value('target'), outcome: value('outcome') }
    const change: Change = mode.type === 'milestone' ? { type: 'milestone-name', name: milestone, previous: mode.previous }
      : mode.type === 'create' ? { type: 'create', value: details, starter }
      : { type: 'details', value: details }
    const result = await onSave(change, mode.type === 'create' ? 'Account created.' : mode.type === 'details' ? 'Account updated.' : mode.previous ? 'Milestone updated.' : 'Milestone added.')
    if (!Object.keys(result).length) close()
    else {
      setErrors(result)
      requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
    }
  }

  function inputProps(name: string) {
    return { id: 'edit-' + name, name, 'aria-invalid': Boolean(errors[name]), 'aria-describedby': errors[name] ? 'error-' + name : undefined }
  }

  function field(name: string, label: string, initial = '', type = 'text') {
    const props = { ...inputProps(name), defaultValue: initial, required: name !== 'owner' }
    return <div className="field">
      <label htmlFor={props.id}>{label}</label>
      {type === 'textarea' ? <textarea {...props} maxLength={500} rows={3} /> : <input {...props} type={type} maxLength={80} />}
      {fieldError(name)}
    </div>
  }

  function fieldError(name: string) {
    return errors[name] && <span className="error" id={'error-' + name}>{errors[name]}</span>
  }

  return <dialog ref={dialog} aria-labelledby="account-editor-title" onCancel={event => { if (busy) event.preventDefault(); else onClose() }}>
    <form onSubmit={submit} noValidate>
      <h2 id="account-editor-title">{title}</h2>
      <fieldset disabled={busy}>
        {mode.type === 'milestone' ? <>
          {!mode.previous && <div className="field">
            <label htmlFor="milestone-suggestion">Start from a suggestion (optional)</label>
            <select id="milestone-suggestion" defaultValue="" onChange={event => { if (event.target.value) setMilestone(event.target.value) }}>
              <option value="">Write a custom milestone</option>
              {suggestedMilestones.map(name => <option key={name}>{name}</option>)}
            </select>
          </div>}
          <div className="field">
            <label htmlFor="edit-milestoneName">Milestone name</label>
            <input {...inputProps('milestoneName')} value={milestone} onChange={event => setMilestone(event.target.value)} maxLength={100} required />
            {fieldError('milestoneName')}
          </div>
        </> : <>
          {field('name', 'Account name', account?.name)}
          {field('owner', 'Account owner (optional)', account?.owner)}
          <div className="grid gap-3 sm:grid-cols-2">
            {field('started', 'Onboarding start date', account?.started ?? demoDay, 'date')}
            {field('target', 'Target date', account?.target, 'date')}
          </div>
          {field('outcome', 'Desired outcome', account?.outcome ?? invoiceOutcome, 'textarea')}
          {mode.type === 'create' && <div className="field">
            <label htmlFor="milestone-template">Milestone template</label>
            <select id="milestone-template" value={starter ? 'starter' : 'blank'} onChange={event => setStarter(event.target.value === 'starter')}>
              <option value="starter">Invoice approval onboarding</option>
              <option value="blank">Start without milestones</option>
            </select>
            {starter && <ul className="list-disc pl-5 text-sm text-muted">{starterMilestones.map(name => <li key={name}>{name}</li>)}</ul>}
          </div>}
        </>}
      </fieldset>
      {!!Object.keys(errors).length && <p className="error" role="alert">{errors.form ?? 'Correct the highlighted fields and try again.'}</p>}
      <div className="dialog-actions">
        <button type="button" className="secondary" disabled={busy} onClick={close}>Cancel</button>
        <button type="submit" className="primary" disabled={busy}>{busy ? 'Saving…' : mode.type === 'create' ? 'Create account' : 'Save changes'}</button>
      </div>
    </form>
  </dialog>
}
