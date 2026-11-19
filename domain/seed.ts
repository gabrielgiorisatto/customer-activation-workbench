import { invoiceOutcome, type Account } from './model.ts'

export function seed(): Account[] {
  const common = {
    started: '2026-11-05',
    outcome: invoiceOutcome,
    owner: 'Onboarding manager',
  }
  return [
    { ...common, name: 'Alpha', target: '2026-11-22',
      milestones: [{ name: 'Workspace setup', done: true }, { name: 'Training', done: true }, { name: 'Sample data mapping', done: false }],
      blocker: { description: 'Sample invoice fields are mapped incorrectly. A specialist must fix the mapping before the finance owner can verify approval.', party: 'Internal', owner: 'Implementation specialist' } },
    { ...common, name: 'Beta', target: '2026-11-21',
      milestones: [{ name: 'Import invoice data', done: true }, { name: 'Capture approval policy', done: false }],
      blocker: { description: 'The required approval policy has not been provided.', party: 'Customer', owner: 'Customer finance lead' } },
    { ...common, name: 'Gamma', target: '2026-11-19',
      milestones: [{ name: 'Agreed workflow', done: true }],
      evidence: { invoice: 'DEMO-GAM-014', approver: 'Gamma finance owner', date: '2026-11-18', workflow: 'Representative invoice approved by the finance owner using the agreed routing and sign-off rules.' } },
    { ...common, name: 'Delta', target: '2026-11-26', owner: 'Implementation specialist',
      milestones: [{ name: 'Workspace setup (scheduled for Nov 20)', done: false }] },
    { ...common, name: 'Epsilon', target: '2026-11-14', owner: '',
      milestones: [] },
    { ...common, name: 'Zeta', target: '2026-11-20',
      milestones: [{ name: 'Training', done: true }, { name: 'Agree on representative workflow', done: false }],
      blocker: { description: 'The customer disputes that the sample workflow reflects its actual approval process.', party: 'Joint', owner: 'Customer finance lead and onboarding manager' } },
  ]
}