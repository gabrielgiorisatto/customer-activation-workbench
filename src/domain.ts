export const demoDay = '2026-11-19'
export const capacity = 2
export type Party = 'Internal' | 'Customer' | 'Joint' | 'Unknown'
export type Action = { description: string; owner: string; followUp: string }
export type Evidence = { invoice: string; approver: string; date: string; workflow: string }
export type Blocker = { description: string; party: Party; owner: string; resolution?: string }
export type AccountDetails = { name: string; target: string; started: string; outcome: string; owner: string }
export type AccountEvent = { id: string; at: string; title: string; detail: string }
export const historyLimit = 20
export type Account = AccountDetails & {
  history?: AccountEvent[]
  id?: string
  milestones: { name: string; done: boolean }[]
  blocker?: Blocker; action?: Action; evidence?: Evidence
}
export const accountKey = (account: Account) => account.id ?? account.name
export const invoiceOutcome = 'Have the finance owner approve a representative invoice through the agreed approval workflow.'
export const starterMilestones = ['Set up workspace', 'Confirm approval policy', 'Configure agreed workflow', 'Validate representative invoice routing'] as const
export const suggestedMilestones = [...starterMilestones, 'Import invoice data', 'Train finance team'] as const

export type Change =
  | { type: 'create'; value: AccountDetails; starter: boolean }
  | { type: 'details'; value: AccountDetails }
  | { type: 'milestone-name'; name: string; previous?: string }
  | { type: 'action'; value: Action }
  | { type: 'release' }
  | { type: 'milestone'; index: number; done: boolean; expected?: string }
  | { type: 'blocker'; value: Blocker }
  | { type: 'resolve'; note: string }
  | { type: 'verify'; value: Evidence }

export const daysBetween = (start: string, end: string) =>
  (Date.parse(end) - Date.parse(start)) / 86_400_000

export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value
}

export function evidenceErrors(account: Account, evidence: Evidence) {
  const errors: Record<string, string> = {}
  if (!evidence.invoice.trim()) errors.invoice = 'Enter the representative invoice reference.'
  if (!evidence.approver.trim()) errors.approver = 'Enter the finance owner who approved it.'
  if (!evidence.workflow.trim()) errors.workflow = 'Describe how approval followed the agreed workflow.'
  if (!validDate(evidence.date) || evidence.date < account.started || evidence.date > demoDay)
    errors.date = 'Use an approval date from onboarding start through the demo date.'
  return errors
}

export function activated(account: Account) {
  return Boolean(account.evidence && !Object.keys(evidenceErrors(account, account.evidence)).length)
}

export function status(account: Account) {
  if (activated(account)) return 'Activated'
  if (account.blocker && !account.blocker.resolution)
    return account.blocker.party === 'Customer' ? 'Waiting on customer' : 'Blocked'
  if (daysBetween(demoDay, account.target) < 0) return 'Needs attention'
  return 'In progress'
}

export function explainStatus(account: Account) {
  const label = status(account)
  const followUp = account.action
    ? `Follow up with ${account.action.owner} on ${dateLabel(account.action.followUp)}.`
    : undefined
  switch (label) {
    case 'Activated':
      return { label, tone: 'green', reason: 'The finance owner approved a representative invoice through the agreed workflow.', next: 'Review the approval record under First value milestone.' }
    case 'Blocked':
      return { label, tone: 'red', reason: `An open ${account.blocker?.party.toLowerCase()} blocker is recorded.`, next: followUp ?? 'Review the blocker, then plan the next action or record its resolution.' }
    case 'Waiting on customer':
      return { label, tone: 'amber', reason: 'The customer owns an open dependency.', next: followUp ?? 'Follow up with the customer and record their update before resolving the dependency.' }
    case 'Needs attention':
      return { label, tone: 'red', reason: `The target is ${deadline(account).toLowerCase()} and first value is still unverified.`, next: followUp ?? 'Plan an intervention and assign someone to investigate the delay.' }
    case 'In progress':
      return { label, tone: 'blue', reason: 'The target has not passed and no open blocker is recorded.', next: followUp ?? 'Review the next milestone. Record evidence once the finance owner approves an invoice.' }
  }
}

export function priority(account: Account) {
  const days = daysBetween(demoDay, account.target)
  const dependency = account.blocker?.resolution ? undefined : account.blocker?.party
  if (activated(account)) return { rank: 9, label: 'Verified', reason: 'Finance owner approval is recorded.' }
  if (account.action) return { rank: 8, label: 'Intervention planned', reason: `${account.action.owner} owns the next action. Follow up ${dateLabel(account.action.followUp)}.` }
  if (days < 0 && dependency !== 'Customer')
    return { rank: 0, label: 'Urgent', reason: account.owner ? 'The target has passed and no intervention is planned.' : 'Overdue with no owner or next action. Assign someone to investigate.' }
  if (dependency === 'Internal' && days <= 3)
    return { rank: 1, label: 'Internal unblock', reason: 'The target is within three days and an internal specialist can act.' }
  if (dependency && dependency !== 'Customer')
    return { rank: 2, label: 'Needs coordination', reason: 'Clarify the dependency with the people who can resolve it.' }
  if (dependency === 'Customer')
    return { rank: 7, label: 'Customer-owned', reason: 'The customer owns the open dependency. Track the promised update and record evidence when it arrives.' }
  return { rank: 6, label: 'Monitor', reason: 'No open blocker. Monitor the next milestone.' }
}

export function weekStart(date: string) {
  const day = new Date(date)
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7)
  return day.toISOString().slice(0, 10)
}

export function interventionWeek(account: Account) {
  return account.action && !activated(account) ? weekStart(account.action.followUp) : undefined
}

export function recommendations(accounts: Account[]) {
  const slots = capacity - accounts.filter(account => interventionWeek(account) === weekStart(demoDay)).length
  return accounts.filter(account => priority(account).rank <= 2).sort((a, b) =>
    priority(a).rank - priority(b).rank || a.target.localeCompare(b.target) || a.name.localeCompare(b.name)
  ).slice(0, Math.max(0, slots))
}

export const dateLabel = (date: string) => new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', timeZone: 'UTC',
}).format(new Date(date))

export function deadline(account: Account) {
  const days = daysBetween(demoDay, account.target)
  if (days === 0) return 'Today'
  const unit = Math.abs(days) === 1 ? 'day' : 'days'
  return days < 0 ? `${-days} ${unit} overdue` : `In ${days} ${unit}`
}

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
      next = { ...account, ...validated.details, id: accountKey(account) }
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
