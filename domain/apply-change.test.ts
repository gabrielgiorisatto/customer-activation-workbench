import { describe, expect, it } from 'vitest'
import { demoDay } from './model.ts'
import { activated, applyChange, priority, recommendations, status, type Change } from './index.ts'
import { seed, seedAccountIds } from './seed.ts'

const { Alpha, Beta, Delta, Epsilon, Zeta } = seedAccountIds

const action = {
  description: 'Investigate the handoff and identify the finance owner.',
  owner: 'Onboarding manager',
  followUp: '2026-11-20',
}
const evidence = {
  invoice: 'DEMO-EPS-001',
  approver: 'Epsilon finance owner',
  date: demoDay,
  workflow: 'Approved in the agreed two-step representative workflow.',
}
const find = (accounts: ReturnType<typeof seed>, name: string) => accounts.find(account => account.name === name)!

describe('applyChange', () => {
  it('validates the action and records a plan without activating Epsilon', () => {
    const accounts = seed()
    const rejected = applyChange(accounts, Epsilon, { type: 'action', value: { ...action, owner: ' ', followUp: '2026-11-18' } })
    expect(rejected.errors).toHaveProperty('owner')
    expect(rejected.errors).toHaveProperty('followUp')
    expect(rejected.accounts).toBe(accounts)
    const planned = applyChange(accounts, Epsilon, { type: 'action', value: action }).accounts
    expect(priority(find(planned, 'Epsilon')).label).toBe('Intervention planned')
    expect(activated(find(planned, 'Epsilon'))).toBe(false)
    expect(find(planned, 'Epsilon').owner).toBe('')
    expect(recommendations(planned).map(account => account.name)).toEqual(['Alpha'])
  })

  it('enforces two intervention slots and frees a slot upon activation', () => {
    let accounts = applyChange(seed(), Epsilon, { type: 'action', value: action }).accounts
    accounts = applyChange(accounts, Alpha, { type: 'action', value: action }).accounts
    expect(applyChange(accounts, Zeta, { type: 'action', value: action }).errors).toHaveProperty('followUp')
    expect(recommendations(accounts)).toEqual([])
    accounts = applyChange(accounts, Epsilon, { type: 'verify', value: evidence }).accounts
    expect(status(find(accounts, 'Epsilon'))).toBe('Activated')
    expect(recommendations(accounts).map(account => account.name)).toEqual(['Zeta'])
  })

  it('allocates slots by follow-up week and protects existing plans when rescheduling', () => {
    const nextWeek = { ...action, followUp: '2026-11-23' }
    let accounts = applyChange(seed(), Delta, { type: 'action', value: nextWeek }).accounts
    expect(recommendations(accounts).map(account => account.name)).toEqual(['Epsilon', 'Alpha'])
    accounts = applyChange(accounts, Epsilon, { type: 'action', value: { ...action, followUp: '2026-11-22' } }).accounts
    accounts = applyChange(accounts, Alpha, { type: 'action', value: action }).accounts
    const rejected = applyChange(accounts, Delta, { type: 'action', value: action })
    expect(rejected.errors).toHaveProperty('followUp')
    expect(find(rejected.accounts, 'Delta').action).toEqual(nextWeek)
    expect(applyChange(accounts, Zeta, { type: 'action', value: nextWeek }).errors).toEqual({})
  })

  it('rejects unsupported claims and accepts recorded, dated evidence', () => {
    const accounts = seed()
    expect(applyChange(accounts, Epsilon, {
      type: 'verify', value: { invoice: '', approver: '', workflow: '', date: '2026-11-20' },
    }).errors).toMatchObject({ invoice: expect.any(String), approver: expect.any(String), workflow: expect.any(String), date: expect.any(String) })
    expect(applyChange(accounts, Epsilon, { type: 'verify', value: evidence }).errors).toEqual({})
  })

  it('retains intervention and blocker history without recording failed or unchanged edits', () => {
    let accounts = seed()
    const change = (update: Change) => { accounts = applyChange(accounts, Epsilon, update).accounts }
    change({ type: 'release' })
    change({ type: 'action', value: { ...action, owner: '' } })
    expect(find(accounts, 'Epsilon').history).toBeUndefined()
    change({ type: 'action', value: action })
    change({ type: 'action', value: action })
    change({ type: 'release' })
    change({ type: 'blocker', value: { description: 'Missing mapping', owner: 'Implementation', party: 'Internal' } })
    change({ type: 'resolve', note: 'Mapping corrected' })
    const account = find(accounts, 'Epsilon')
    expect(account.action).toBeUndefined()
    expect(account.history?.map(event => event.title)).toEqual([
      'Blocker resolved', 'Blocker recorded', 'Intervention canceled', 'Intervention planned',
    ])
    expect(account.history?.[0].detail).toContain('Mapping corrected')
    expect(account.history?.[3].detail).toContain(action.description)
  })

  it('keeps Beta blocked after milestone updates and requires a resolution note', () => {
    let accounts = applyChange(seed(), Beta, { type: 'milestone', index: 1, done: true }).accounts
    expect(status(find(accounts, 'Beta'))).toBe('Waiting on customer')
    expect(applyChange(accounts, Beta, { type: 'verify', value: evidence }).errors).toHaveProperty('form')
    expect(applyChange(accounts, Beta, { type: 'resolve', note: '' }).errors).toHaveProperty('note')
    accounts = applyChange(accounts, Beta, { type: 'resolve', note: 'Simulated finance lead confirmed the policy was provided.' }).accounts
    expect(status(find(accounts, 'Beta'))).toBe('In progress')
    expect(activated(find(accounts, 'Beta'))).toBe(false)
  })
})