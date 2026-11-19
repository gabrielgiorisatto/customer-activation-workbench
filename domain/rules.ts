import { capacity, demoDay, type Account, type Evidence } from './model.ts'

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