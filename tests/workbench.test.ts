import initSqlJs from 'sql.js'
import { populateSnapshot, selectSnapshot } from '../src/explorer-sql'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { api, type Database } from '../server/api'
import { activated, applyChange, deadline, demoDay, priority, recommendations, status, type Change } from '../src/domain'
import { seed } from '../src/seed'

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

describe('activation workbench', () => {
  it('prioritizes overdue Epsilon and internally unblockable Alpha over Beta and Zeta', () => {
    const accounts = seed()
    expect(recommendations(accounts).map(account => account.name)).toEqual(['Epsilon', 'Alpha'])
    expect(deadline(find(accounts, 'Epsilon'))).toBe('5 days overdue')
    expect(deadline(find(accounts, 'Zeta'))).toBe('In 1 day')
    expect(priority(find(accounts, 'Beta')).label).toBe('Customer-owned')
    expect(status(find(accounts, 'Gamma'))).toBe('Activated')
  })

  it('validates the action and records a plan without activating Epsilon', () => {
    const accounts = seed()
    const rejected = applyChange(accounts, 'Epsilon', { type: 'action', value: { ...action, owner: ' ', followUp: '2026-11-18' } })
    expect(rejected.errors).toHaveProperty('owner')
    expect(rejected.errors).toHaveProperty('followUp')
    expect(rejected.accounts).toBe(accounts)
    const planned = applyChange(accounts, 'Epsilon', { type: 'action', value: action }).accounts
    expect(priority(find(planned, 'Epsilon')).label).toBe('Intervention planned')
    expect(activated(find(planned, 'Epsilon'))).toBe(false)
    expect(find(planned, 'Epsilon').owner).toBe('')
    expect(recommendations(planned).map(account => account.name)).toEqual(['Alpha'])
  })

  it('enforces two intervention slots and frees a slot upon activation', () => {
    let accounts = applyChange(seed(), 'Epsilon', { type: 'action', value: action }).accounts
    accounts = applyChange(accounts, 'Alpha', { type: 'action', value: action }).accounts
    expect(applyChange(accounts, 'Zeta', { type: 'action', value: action }).errors).toHaveProperty('followUp')
    expect(recommendations(accounts)).toEqual([])
    accounts = applyChange(accounts, 'Epsilon', { type: 'verify', value: evidence }).accounts
    expect(status(find(accounts, 'Epsilon'))).toBe('Activated')
    expect(recommendations(accounts).map(account => account.name)).toEqual(['Zeta'])
  })

  it('allocates slots by follow-up week and protects existing plans when rescheduling', () => {
    const nextWeek = { ...action, followUp: '2026-11-23' }
    let accounts = applyChange(seed(), 'Delta', { type: 'action', value: nextWeek }).accounts
    expect(recommendations(accounts).map(account => account.name)).toEqual(['Epsilon', 'Alpha'])
    accounts = applyChange(accounts, 'Epsilon', { type: 'action', value: { ...action, followUp: '2026-11-22' } }).accounts
    accounts = applyChange(accounts, 'Alpha', { type: 'action', value: action }).accounts
    const rejected = applyChange(accounts, 'Delta', { type: 'action', value: action })
    expect(rejected.errors).toHaveProperty('followUp')
    expect(find(rejected.accounts, 'Delta').action).toEqual(nextWeek)
    expect(applyChange(accounts, 'Zeta', { type: 'action', value: nextWeek }).errors).toEqual({})
  })

  it('rejects unsupported claims and accepts recorded, dated evidence', () => {
    const accounts = seed()
    expect(applyChange(accounts, 'Epsilon', {
      type: 'verify', value: { invoice: '', approver: '', workflow: '', date: '2026-11-20' },
    }).errors).toMatchObject({ invoice: expect.any(String), approver: expect.any(String), workflow: expect.any(String), date: expect.any(String) })
    expect(applyChange(accounts, 'Epsilon', { type: 'verify', value: evidence }).errors).toEqual({})
  })

  it('retains intervention and blocker history without recording failed or unchanged edits', () => {
    let accounts = seed()
    const change = (update: Change) => { accounts = applyChange(accounts, 'Epsilon', update).accounts }
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
    let accounts = applyChange(seed(), 'Beta', { type: 'milestone', index: 1, done: true }).accounts
    expect(status(find(accounts, 'Beta'))).toBe('Waiting on customer')
    expect(applyChange(accounts, 'Beta', { type: 'verify', value: evidence }).errors).toHaveProperty('form')
    expect(applyChange(accounts, 'Beta', { type: 'resolve', note: '' }).errors).toHaveProperty('note')
    accounts = applyChange(accounts, 'Beta', { type: 'resolve', note: 'Simulated finance lead confirmed the policy was provided.' }).accounts
    expect(status(find(accounts, 'Beta'))).toBe('In progress')
    expect(activated(find(accounts, 'Beta'))).toBe(false)
  })

  it('persists a saved intervention in SQLite across requests and isolates visitor sessions', async () => {
    const sqlite = new DatabaseSync(':memory:')
    try {
      sqlite.exec(readFileSync('drizzle/0000_sessions.sql', 'utf8'))
      const db: Database = { prepare: sql => ({ bind: (...values) => ({
        first: async <T>() => (sqlite.prepare(sql).get(...values) as T | undefined) ?? null,
        run: async () => ({ meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } }),
      }) }) }
      const url = 'https://demo.test/api/accounts'
      const initial = await api(new Request(url), db)
      const cookie = initial.headers.get('set-cookie')!.split(';')[0]
      const patch = (change: Change) => api(new Request(url + '/Epsilon', {
        method: 'PATCH', headers: { cookie }, body: JSON.stringify(change),
      }), db)
      expect((await patch({ type: 'action', value: { ...action, owner: '' } })).status).toBe(422)
      expect((await patch({ type: 'action', value: action })).status).toBe(200)
      const reloaded = await api(new Request(url, { headers: { cookie } }), db)
      const reloadedEpsilon = find((await reloaded.json()).accounts, 'Epsilon')
      expect(reloadedEpsilon.action).toEqual(action)
      expect(reloadedEpsilon.history?.[0].title).toBe('Intervention planned')
      const secondAction = { ...action, description: 'Fix Alpha’s sample mapping', followUp: '2026-11-19' }
      const second = await api(new Request(url + '/Alpha', {
        method: 'PATCH', headers: { cookie }, body: JSON.stringify({ type: 'action', value: secondAction }),
      }), db)
      expect(second.status).toBe(200)
      const third = await api(new Request(url + '/Zeta', {
        method: 'PATCH', headers: { cookie }, body: JSON.stringify({ type: 'action', value: action }),
      }), db)
      expect(third.status).toBe(422)
      const plans = await api(new Request(url, { headers: { cookie } }), db)
      const plannedAccounts = (await plans.json()).accounts
      expect(find(plannedAccounts, 'Epsilon').action).toEqual(action)
      expect(find(plannedAccounts, 'Alpha').action).toEqual(secondAction)
      expect(find(plannedAccounts, 'Zeta').action).toBeUndefined()

      const other = await api(new Request(url), db)
      expect(find((await other.json()).accounts, 'Epsilon').action).toBeUndefined()
      const otherCookie = other.headers.get('set-cookie')!.split(';')[0]
      await api(new Request(url + '/Epsilon', {
        method: 'PATCH', headers: { cookie: otherCookie }, body: JSON.stringify({ type: 'action', value: action }),
      }), db)
      const resetUrl = 'https://demo.test/api/reset'
      expect((await api(new Request(resetUrl, { method: 'POST', headers: { cookie } }), db)).status).toBe(403)
      const reset = await api(new Request(resetUrl, {
        method: 'POST', headers: { cookie, 'x-demo-action': 'reset' },
      }), db)
      expect((await reset.json()).accounts).toEqual(seed())
      const restored = await api(new Request(url, { headers: { cookie } }), db)
      expect((await restored.json()).accounts).toEqual(seed())
      const value = { name: 'Northwind & Co.', owner: 'Ada', outcome: 'Approve a representative invoice for Northwind.', started: demoDay, target: '2026-11-24' }
      const send = (url: string, method: string, change: Change) => api(new Request(url, {
        method, headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(change),
      }), db)
      const created = await send(url, 'POST', { type: 'create', value, starter: true })
      expect(created.status).toBe(201)
      const { createdId } = await created.json()
      const newUrl = url + '/' + createdId
      const renamed = await send(newUrl, 'PATCH', { type: 'details', value: { ...value, name: 'Northwind Europe' } })
      expect(renamed.status).toBe(200)
      await send(newUrl, 'PATCH', { type: 'milestone', index: 0, done: true, expected: 'Set up workspace' })
      await send(newUrl, 'PATCH', { type: 'milestone-name', name: 'Workspace configured', previous: 'Set up workspace' })
      await send(newUrl, 'PATCH', { type: 'milestone-name', name: 'Test delegated approval' })
      const reload = await api(new Request(url, { headers: { cookie } }), db)
      const persisted = find((await reload.json()).accounts, 'Northwind Europe')
      expect(persisted.milestones).toContainEqual({ name: 'Workspace configured', done: true })
      expect(persisted.milestones).toContainEqual({ name: 'Test delegated approval', done: false })
      expect(activated(persisted)).toBe(false)
      expect((await send(url, 'POST', { type: 'create', value: { ...value, name: ' northwind europe ' }, starter: false })).status).toBe(422)
      expect((await send(newUrl, 'PATCH', { type: 'details', value: { ...value, target: '2026-11-18' } })).status).toBe(422)
      const untouched = await api(new Request(url, { headers: { cookie: otherCookie } }), db)
      expect(find((await untouched.json()).accounts, 'Epsilon').action).toEqual(action)
    } finally { sqlite.close() }
  })
})

it('joins snapshot tables and rejects writes and additional statements', async () => {
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  try {
    const accounts = applyChange(seed(), 'Epsilon', { type: 'action', value: action }).accounts
    populateSnapshot(db, accounts)
    expect(selectSnapshot(db, 'SELECT a.account, e.invoice FROM accounts a JOIN activation_evidence e USING(account);').rows)
      .toEqual([['Gamma', 'DEMO-GAM-014']])
    expect(selectSnapshot(db, 'SELECT h.title, a.account FROM activity_history h JOIN accounts a USING(account_id);').rows)
      .toEqual([['Intervention planned', 'Epsilon']])
    expect(selectSnapshot(db, 'SELECT account FROM interventions;').rows).toEqual([['Epsilon']])
    expect(() => selectSnapshot(db, 'DELETE FROM accounts')).toThrow(/SELECT/)
    expect(() => selectSnapshot(db, 'SELECT * FROM accounts; DELETE FROM accounts')).toThrow()
    expect(selectSnapshot(db, 'SELECT COUNT(*) FROM accounts').rows).toEqual([[6]])
  } finally { db.close() }
})
