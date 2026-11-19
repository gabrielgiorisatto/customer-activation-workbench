import { applyChange, type Account, type Change } from '../src/domain.ts'
import { seed } from '../src/seed.ts'

export type Database = {
  prepare(sql: string): {
    bind(...values: (string | number)[]): {
      first<T>(): Promise<T | null>
      run(): Promise<{ meta: { changes: number } }>
    }
  }
}

function parseChange(input: unknown): Change | undefined {
  if (!input || typeof input !== 'object' || !('type' in input)) return
  const body = input as Record<string, unknown>
  const value = body.value as Record<string, unknown> | undefined
  const fields = (...keys: string[]) => keys.every(key =>
    typeof value?.[key] === 'string' && value[key].length <= 2000)
  switch (body.type) {
    case 'create': if (fields('name', 'target', 'started', 'outcome', 'owner') && typeof body.starter === 'boolean') return input as Change; break
    case 'details': if (fields('name', 'target', 'started', 'outcome', 'owner')) return input as Change; break
    case 'milestone-name': if (typeof body.name === 'string' && (body.previous === undefined || typeof body.previous === 'string')) return input as Change; break
    case 'action': if (fields('description', 'owner', 'followUp')) return input as Change; break
    case 'blocker': if (fields('description', 'owner', 'party')) return input as Change; break
    case 'verify': if (fields('invoice', 'approver', 'date', 'workflow')) return input as Change; break
    case 'resolve': if (typeof body.note === 'string' && body.note.length <= 2000) return input as Change; break
    case 'milestone': if (Number.isInteger(body.index) && typeof body.done === 'boolean' && (body.expected === undefined || typeof body.expected === 'string')) return input as Change; break
    case 'release': return { type: 'release' }
  }
}

function readAccounts(payload?: string): Account[] {
  if (!payload) return seed()
  const accounts: (Account & { update?: string })[] = JSON.parse(payload)
  return accounts.map(({ update: _seedNote, ...account }) => account)
}

export async function api(request: Request, db: Database) {
  const url = new URL(request.url)
  const storedId = request.headers.get('cookie')?.match(/(?:^|;\s*)activation_demo=([\da-f-]{36})(?:;|$)/)?.[1]
  const id = storedId ?? crypto.randomUUID()
  const headers = new Headers({ 'cache-control': 'no-store' })
  if (!storedId) headers.set('set-cookie', `activation_demo=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${url.protocol === 'https:' ? '; Secure' : ''}`)
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers })
  const read = () => db.prepare('SELECT payload, revision FROM demo_sessions WHERE id = ?').bind(id)
    .first<{ payload: string; revision: number }>()
  if (request.method === 'GET' && url.pathname === '/api/accounts') {
    const row = storedId ? await read() : null
    return json({ accounts: readAccounts(row?.payload) })
  }
  if (request.method === 'POST' && url.pathname === '/api/reset') {
    if (request.headers.get('sec-fetch-site') === 'cross-site' || request.headers.get('x-demo-action') !== 'reset')
      return json({ errors: { form: 'Reset must come from this site.' } }, 403)
    if (storedId) await db.prepare('DELETE FROM demo_sessions WHERE id = ?').bind(id).run()
    return json({ accounts: seed() })
  }
  const key = url.pathname.match(/^\/api\/accounts\/([A-Za-z0-9-]+)$/)?.[1]
  const creating = request.method === 'POST' && url.pathname === '/api/accounts'
  if (!creating && (request.method !== 'PATCH' || !key)) return json({ errors: { form: 'Endpoint not found.' } }, 404)
  const raw = await request.text()
  if (raw.length > 10_000) return json({ errors: { form: 'Update is too large.' } }, 413)
  let change: Change | undefined
  try { change = parseChange(JSON.parse(raw)) } catch { /* Invalid JSON. */ }
  if (!change || (change.type === 'create') !== creating) return json({ errors: { form: 'Invalid update.' } }, 400)
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await read()
    const accounts: Account[] = readAccounts(row?.payload)
    const result = applyChange(accounts, key ?? '', change)
    if (Object.keys(result.errors).length) return json({ errors: result.errors }, 422)
    const payload = JSON.stringify(result.accounts)
    const write = row
      ? db.prepare('UPDATE demo_sessions SET payload = ?, revision = revision + 1 WHERE id = ? AND revision = ?').bind(payload, id, row.revision)
      : db.prepare('INSERT OR IGNORE INTO demo_sessions (id, payload) VALUES (?, ?)').bind(id, payload)
    if ((await write.run()).meta.changes) return json({ accounts: result.accounts, createdId: creating ? result.accounts.at(-1)?.id : undefined }, creating ? 201 : 200)
  }
  return json({ errors: { form: 'The account changed in another tab. Try again.' } }, 409)
}
