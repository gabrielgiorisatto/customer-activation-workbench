import initSqlJs from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url&inline'
import type { Account } from '@domain/index.ts'
import { populateSnapshot, selectSnapshot } from './explorer-sql.ts'

self.onmessage = async ({ data }: MessageEvent<{ accounts: Account[]; sql: string }>) => {
  try {
    const SQL = await initSqlJs({ locateFile: () => wasmUrl, useOldExtensionFunctions: false })
    const db = new SQL.Database()
    try {
      populateSnapshot(db, data.accounts)
      self.postMessage({ result: selectSnapshot(db, data.sql) })
    } finally { db.close() }
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Could not run the query.' })
  }
}
