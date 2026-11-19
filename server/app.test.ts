import { describe, expect, it } from 'vitest'
import { activated, demoDay, type Change } from '../domain/index.ts'
import { seed } from '../domain/seed.ts'
import { handleRequest } from './src/sessions.ts'
import { openMemoryDatabase } from './src/sqlite-store.ts'

const action = {
  description: 'Investigate the handoff and identify the finance owner.',
  owner: 'Onboarding manager',
  followUp: '2026-11-20',
}
const find = (accounts: ReturnType<typeof seed>, name: string) => accounts.find(account => account.name === name)!

describe('HTTP sessions', () => {
  it('persists a saved intervention in SQLite across requests and isolates visitor sessions', async () => {
    const { db, close } = openMemoryDatabase()
    try {
      const url = 'https://demo.test/api/accounts'
      const initial = await handleRequest(new Request(url), db)
      const cookie = initial.headers.get('set-cookie')!.split(';')[0]
      const patch = (change: Change) => handleRequest(new Request(url + '/Epsilon', {
        method: 'PATCH', headers: { cookie }, body: JSON.stringify(change),
      }), db)
      expect((await patch({ type: 'action', value: { ...action, owner: '' } })).status).toBe(422)
      expect((await patch({ type: 'action', value: action })).status).toBe(200)
      const reloaded = await handleRequest(new Request(url, { headers: { cookie } }), db)
      const reloadedEpsilon = find((await reloaded.json()).accounts, 'Epsilon')
      expect(reloadedEpsilon.action).toEqual(action)
      expect(reloadedEpsilon.history?.[0].title).toBe('Intervention planned')
      const secondAction = { ...action, description: 'Fix Alpha’s sample mapping', followUp: '2026-11-19' }
      expect((await handleRequest(new Request(url + '/Alpha', {
        method: 'PATCH', headers: { cookie }, body: JSON.stringify({ type: 'action', value: secondAction }),
      }), db)).status).toBe(200)
      expect((await handleRequest(new Request(url + '/Zeta', {
        method: 'PATCH', headers: { cookie }, body: JSON.stringify({ type: 'action', value: action }),
      }), db)).status).toBe(422)
      const plans = await handleRequest(new Request(url, { headers: { cookie } }), db)
      const plannedAccounts = (await plans.json()).accounts
      expect(find(plannedAccounts, 'Epsilon').action).toEqual(action)
      expect(find(plannedAccounts, 'Alpha').action).toEqual(secondAction)
      expect(find(plannedAccounts, 'Zeta').action).toBeUndefined()

      const other = await handleRequest(new Request(url), db)
      expect(find((await other.json()).accounts, 'Epsilon').action).toBeUndefined()
      const otherCookie = other.headers.get('set-cookie')!.split(';')[0]
      await handleRequest(new Request(url + '/Epsilon', {
        method: 'PATCH', headers: { cookie: otherCookie }, body: JSON.stringify({ type: 'action', value: action }),
      }), db)
      const resetUrl = 'https://demo.test/api/reset'
      expect((await handleRequest(new Request(resetUrl, { method: 'POST', headers: { cookie } }), db)).status).toBe(403)
      const reset = await handleRequest(new Request(resetUrl, {
        method: 'POST', headers: { cookie, 'x-demo-action': 'reset' },
      }), db)
      expect((await reset.json()).accounts).toEqual(seed())
      const restored = await handleRequest(new Request(url, { headers: { cookie } }), db)
      expect((await restored.json()).accounts).toEqual(seed())
      const value = { name: 'Northwind & Co.', owner: 'Ada', outcome: 'Approve a representative invoice for Northwind.', started: demoDay, target: '2026-11-24' }
      const send = (path: string, method: string, change: Change) => handleRequest(new Request(path, {
        method, headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(change),
      }), db)
      const created = await send(url, 'POST', { type: 'create', value, starter: true })
      expect(created.status).toBe(201)
      const { createdId } = await created.json()
      const newUrl = url + '/' + createdId
      expect((await send(newUrl, 'PATCH', { type: 'details', value: { ...value, name: 'Northwind Europe' } })).status).toBe(200)
      await send(newUrl, 'PATCH', { type: 'milestone', index: 0, done: true, expected: 'Set up workspace' })
      await send(newUrl, 'PATCH', { type: 'milestone-name', name: 'Workspace configured', previous: 'Set up workspace' })
      await send(newUrl, 'PATCH', { type: 'milestone-name', name: 'Test delegated approval' })
      const reload = await handleRequest(new Request(url, { headers: { cookie } }), db)
      const persisted = find((await reload.json()).accounts, 'Northwind Europe')
      expect(persisted.milestones).toContainEqual({ name: 'Workspace configured', done: true })
      expect(persisted.milestones).toContainEqual({ name: 'Test delegated approval', done: false })
      expect(activated(persisted)).toBe(false)
      expect((await send(url, 'POST', { type: 'create', value: { ...value, name: ' northwind europe ' }, starter: false })).status).toBe(422)
      expect((await send(newUrl, 'PATCH', { type: 'details', value: { ...value, target: '2026-11-18' } })).status).toBe(422)
      const untouched = await handleRequest(new Request(url, { headers: { cookie: otherCookie } }), db)
      expect(find((await untouched.json()).accounts, 'Epsilon').action).toEqual(action)
    } finally { close() }
  })
})