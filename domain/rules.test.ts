import { describe, expect, it } from 'vitest'
import { deadline, priority, recommendations, status } from './rules.ts'
import { seed } from './seed.ts'

const find = (name: string) => seed().find(account => account.name === name)!

describe('domain rules', () => {
  it('prioritizes overdue Epsilon and internally unblockable Alpha over Beta and Zeta', () => {
    const accounts = seed()
    expect(recommendations(accounts).map(account => account.name)).toEqual(['Epsilon', 'Alpha'])
    expect(deadline(find('Epsilon'))).toBe('5 days overdue')
    expect(deadline(find('Zeta'))).toBe('In 1 day')
    expect(priority(find('Beta')).label).toBe('Customer-owned')
    expect(status(find('Gamma'))).toBe('Activated')
  })
})