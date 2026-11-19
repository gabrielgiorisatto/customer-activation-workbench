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