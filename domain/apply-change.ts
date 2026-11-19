import {
  accountKey, capacity, demoDay, historyLimit, starterMilestones, type Account, type AccountDetails, type Change,
} from './model.ts'
import {
  activated, evidenceErrors, interventionWeek, validDate, weekStart,
} from './rules.ts'

function accountDetails(accounts: Account[], value: AccountDetails, account?: Account) {
  const details = { name: value.name.trim(), outcome: value.outcome.trim(), owner: value.owner.trim(), started: value.started, target: value.target }
  const errors: Record<string, string> = {}
  if (!details.name || details.name.length > 80) errors.name = 'Enter an account name of 1–80 characters.'
  else if (accounts.some(item => item !== account && item.name.toLowerCase() === details.name.toLowerCase()))
    errors.name = 'An account with this name already exists.'
  if (details.owner.length > 80) errors.owner = 'Use at most 80 characters for the owner.'
  if (!details.outcome || details.outcome.length > 500) errors.outcome = 'Enter a desired outcome of 1–500 characters.'
  if (!validDate(details.started)) errors.started = 'Enter a valid onboarding start date.'
  else if (account?.evidence && details.started > account.evidence.date)
    errors.started = 'Onboarding must start on or before the recorded approval.'
  if (!validDate(details.target) || details.target < details.started)
    errors.target = 'Use a target date on or after the onboarding start date.'
  return { details, errors }
}

function recordEvent(account: Account, title: string, detail = ''): Account {
  const event = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    title,
    detail: detail.length > 240 ? detail.slice(0, 239) + '…' : detail,
  }
  return { ...account, history: [event, ...(account.history ?? [])].slice(0, historyLimit) }
}

function recordChange(previous: Account, next: Account, change: Exclude<Change, { type: 'create' }>) {
  switch (change.type) {
    case 'details': {
      const fields = [
        ['name', 'Account name'], ['owner', 'Account owner'], ['started', 'Onboarding start'],
        ['target', 'Target date'], ['outcome', 'Desired outcome'],
      ] as const
      const changes = fields.filter(([key]) => previous[key] !== next[key]).map(([key, label]) =>
        `${label}: ${previous[key] || 'Unassigned'} → ${next[key] || 'Unassigned'}`)
      return changes.length ? recordEvent(next, 'Account details updated', changes.join(' · ')) : previous
    }
    case 'action': {
      if (JSON.stringify(previous.action) === JSON.stringify(next.action)) return previous
      const { owner, followUp, description } = next.action!
      return recordEvent(next, previous.action ? 'Intervention updated' : 'Intervention planned', `${owner} · Follow-up ${followUp} · ${description}`)
    }
    case 'release':
      return previous.action ? recordEvent(next, 'Intervention canceled', `${previous.action.owner} · ${previous.action.description}`) : previous
    case 'blocker':
      if (JSON.stringify(previous.blocker) === JSON.stringify(next.blocker)) return previous
      return recordEvent(next, previous.blocker && !previous.blocker.resolution ? 'Blocker updated' : 'Blocker recorded',
        `${change.value.party} · ${next.blocker!.owner || 'Owner unknown'} · ${next.blocker!.description}`)
    case 'resolve':
      return recordEvent(next, 'Blocker resolved', `${next.blocker!.description.slice(0, 90)} · ${next.blocker!.resolution}`)
    case 'milestone': {
      const milestone = next.milestones[change.index]
      return previous.milestones[change.index].done === milestone.done ? previous
        : recordEvent(next, milestone.done ? 'Milestone completed' : 'Milestone reopened', milestone.name)
    }
    case 'milestone-name': {
      const name = change.name.trim()
      if (name === change.previous) return previous
      return recordEvent(next, change.previous ? 'Milestone renamed' : 'Milestone added',
        change.previous ? `${change.previous} → ${name}` : name)
    }
    case 'verify':
      if (JSON.stringify(previous.evidence) === JSON.stringify(next.evidence)) return previous
      return recordEvent(next, previous.evidence ? 'First value evidence updated' : 'First value verified',
        `${next.evidence!.invoice} · ${next.evidence!.approver} · ${next.evidence!.date}`)
  }
}

export function applyChange(accounts: Account[], key: string, change: Change) {
  if (change.type === 'create') {
    if (accounts.length >= 100) return { accounts, errors: { form: 'This demo portfolio supports up to 100 accounts.' } }
    const { details, errors } = accountDetails(accounts, change.value)
    if (Object.keys(errors).length) return { accounts, errors }
    const milestones = change.starter ? starterMilestones.map(name => ({ name, done: false })) : []
    return { accounts: [...accounts, recordEvent({ ...details, id: crypto.randomUUID(), milestones }, 'Account created')], errors }
  }
  const errors: Record<string, string> = {}
  const account = accounts.find(item => accountKey(item) === key)
  if (!account) return { accounts, errors: { form: 'Account not found.' } }
  let next = account
  switch (change.type) {
    case 'details': {
      const validated = accountDetails(accounts, change.value, account)
      Object.assign(errors, validated.errors)
      next = { ...account, ...validated.details, id: account.id }
      break
    }
    case 'milestone-name': {
      const name = change.name.trim()
      const index = account.milestones.findIndex(item => item.name === change.previous)
      if (change.previous !== undefined && index < 0) errors.form = 'This milestone changed. Refresh and try again.'
      if (!name || name.length > 100) errors.milestoneName = 'Enter a milestone name of 1–100 characters.'
      else if (account.milestones.some((item, position) => position !== index && item.name.toLowerCase() === name.toLowerCase()))
        errors.milestoneName = 'This account already has a milestone with that name.'
      if (index < 0 && account.milestones.length >= 30) errors.form = 'This account already has 30 milestones.'
      const milestones = [...account.milestones]
      if (index < 0) milestones.push({ name, done: false })
      else milestones[index] = { ...milestones[index], name }
      next = { ...account, milestones }
      break
    }
    case 'action': {
      const value = { description: change.value.description.trim(), owner: change.value.owner.trim(), followUp: change.value.followUp }
      if (!value.description) errors.description = 'Describe the next action.'
      if (!value.owner) errors.owner = 'Assign an action owner.'
      if (!validDate(value.followUp) || value.followUp < demoDay)
        errors.followUp = 'Choose the demo date or a later follow-up date.'
      if (activated(account)) errors.form = 'This account has already activated.'
      else if (!errors.followUp && accounts.filter(item => item !== account && interventionWeek(item) === weekStart(value.followUp)).length >= capacity)
        errors.followUp = 'Both slots are in use for that week. Pick another week or release a slot.'
      next = { ...account, action: value }
      break
    }
    case 'release':
      next = { ...account, action: undefined }
      break
    case 'milestone':
      if (!account.milestones[change.index] || (change.expected !== undefined && account.milestones[change.index].name !== change.expected)) errors.form = 'Milestone not found.'
      next = { ...account, milestones: account.milestones.map((item, index) =>
        index === change.index ? { ...item, done: change.done } : item) }
      break
    case 'blocker': {
      const value = { description: change.value.description.trim(), owner: change.value.owner.trim(), party: change.value.party }
      if (!value.description) errors.description = 'Describe the dependency.'
      if (!['Internal', 'Customer', 'Joint', 'Unknown'].includes(value.party)) errors.party = 'Choose who owns the dependency.'
      if (!value.owner && value.party !== 'Unknown') errors.owner = 'Enter a person or role, or select Unknown.'
      if (account.blocker && !account.blocker.resolution && account.blocker.party !== value.party)
        errors.form = 'Record the resolution of the current dependency before changing who owns it.'
      next = { ...account, blocker: value }
      break
    }
    case 'resolve':
      if (!account.blocker || account.blocker.resolution) return { accounts, errors: { form: 'There is no open blocker to resolve.' } }
      if (!change.note.trim()) errors.note = account.blocker.party === 'Internal'
        ? 'Record what resolved this blocker.' : 'Record the customer or owner update that confirms resolution.'
      next = { ...account, blocker: { ...account.blocker, resolution: change.note.trim() } }
      break
    case 'verify':
      Object.assign(errors, evidenceErrors(account, change.value))
      if (account.blocker && !account.blocker.resolution)
        errors.form = 'Record resolution of the open workflow dependency before confirming first value.'
      next = { ...account, evidence: { ...change.value, invoice: change.value.invoice.trim(), approver: change.value.approver.trim(), workflow: change.value.workflow.trim() } }
      break
    default:
      errors.form = 'Unknown update.'
  }
  if (Object.keys(errors).length) return { accounts, errors }
  const updated = recordChange(account, next, change)
  return { accounts: accounts.map(item => item === account ? updated : item), errors }
}