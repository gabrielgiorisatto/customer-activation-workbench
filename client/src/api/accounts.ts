import type { Account, Change } from '@domain/index.ts'

export async function loadAccounts(): Promise<Account[]> {
  const response = await fetch('/api/accounts')
  if (!response.ok) throw new Error('Could not load accounts. Try again.')
  return (await response.json()).accounts
}

export async function updateAccount(key: string, change: Change): Promise<{ accounts?: Account[]; createdId?: string; errors?: Record<string, string> }> {
  const creating = change.type === 'create'
  const response = await fetch(creating ? '/api/accounts' : '/api/accounts/' + encodeURIComponent(key), {
    method: creating ? 'POST' : 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(change),
  })
  return response.json()
}
