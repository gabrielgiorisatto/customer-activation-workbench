import initSqlJs from 'sql.js'
import { describe, expect, it } from 'vitest'
import { applyChange } from '@domain/index.ts'
import { seed } from '@domain/seed.ts'
import { populateSnapshot, selectSnapshot } from './explorer-sql.ts'

const action = {
  description: 'Investigate the handoff and identify the finance owner.',
  owner: 'Onboarding manager',
  followUp: '2026-11-20',
}

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