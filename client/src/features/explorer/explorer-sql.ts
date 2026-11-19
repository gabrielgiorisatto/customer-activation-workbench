import type { Database, SqlValue } from 'sql.js'
import { accountKey, activated, status, type Account } from '@domain/index.ts'

export const tables = ['accounts', 'milestones', 'interventions', 'blockers', 'activation_evidence', 'activity_history'] as const

export function populateSnapshot(db: Database, accounts: Account[]) {
  db.run(`
    CREATE TABLE accounts (account TEXT PRIMARY KEY, target_date TEXT, started_on TEXT, owner TEXT, status TEXT, activated INTEGER, desired_outcome TEXT, account_id TEXT UNIQUE);
    CREATE TABLE milestones (account TEXT, milestone TEXT, completed INTEGER);
    CREATE TABLE interventions (account TEXT, description TEXT, owner TEXT, follow_up TEXT);
    CREATE TABLE blockers (account TEXT, description TEXT, responsibility TEXT, owner TEXT, resolution TEXT);
    CREATE TABLE activation_evidence (account TEXT, invoice TEXT, approver TEXT, approved_on TEXT, workflow TEXT);
    CREATE TABLE activity_history (event_id TEXT PRIMARY KEY, account TEXT, account_id TEXT, recorded_at_utc TEXT, title TEXT, detail TEXT);
  `)
  for (const account of accounts) {
    const { name, action, evidence, blocker } = account
    db.run('INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
      name, account.target, account.started, account.owner || null, status(account), Number(activated(account)), account.outcome, accountKey(account),
    ])
    for (const event of account.history ?? [])
      db.run('INSERT INTO activity_history VALUES (?, ?, ?, ?, ?, ?)', [event.id, name, accountKey(account), event.at, event.title, event.detail])
    for (const milestone of account.milestones)
      db.run('INSERT INTO milestones VALUES (?, ?, ?)', [name, milestone.name, Number(milestone.done)])
    if (action) db.run('INSERT INTO interventions VALUES (?, ?, ?, ?)', [name, action.description, action.owner, action.followUp])
    if (blocker) db.run('INSERT INTO blockers VALUES (?, ?, ?, ?, ?)', [name, blocker.description, blocker.party, blocker.owner || null, blocker.resolution ?? null])
    if (evidence) db.run('INSERT INTO activation_evidence VALUES (?, ?, ?, ?, ?)', [name, evidence.invoice, evidence.approver, evidence.date, evidence.workflow])
  }
  db.run('PRAGMA query_only = ON')
}

export function selectSnapshot(db: Database, sql: string) {
  if (!/^\s*SELECT\b/i.test(sql) || sql.length > 8000)
    throw new Error('Enter one SELECT query with at most 8,000 characters.')
  let result: { columns: string[]; rows: SqlValue[][]; truncated: boolean } | undefined
  for (const statement of db.iterateStatements(sql)) {
    if (result) throw new Error('Run one SELECT query at a time.')
    const columns = statement.getColumnNames()
    const rows: SqlValue[][] = []
    while (rows.length < 100 && statement.step()) rows.push(statement.get())
    const truncated = rows.length === 100 && statement.step()
    result = { columns, rows, truncated }
  }
  if (!result) throw new Error('Enter one SELECT query.')
  return result
}
