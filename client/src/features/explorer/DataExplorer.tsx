import SiteNav from '../shell/SiteNav.tsx'
import { useEffect, useRef, useState } from 'react'
import { Activity, Database, Play, RefreshCw } from 'lucide-react'
import { loadAccounts } from '../../api/accounts.ts'
import type { Account } from '@domain/index.ts'
import { tables, type selectSnapshot } from './explorer-sql.ts'

type Result = ReturnType<typeof selectSnapshot>
const initialQuery = 'SELECT * FROM accounts ORDER BY target_date;'

export default function DataExplorer() {
  const [accounts, setAccounts] = useState<Account[]>()
  const [query, setQuery] = useState(initialQuery)
  const [result, setResult] = useState<Result>()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(true)
  const resetDialog = useRef<HTMLDialogElement>(null)
  const activeQuery = useRef<{ worker: Worker; timeout: number } | null>(null)

  function stopQuery() {
    if (!activeQuery.current) return
    activeQuery.current.worker.terminate()
    clearTimeout(activeQuery.current.timeout)
    activeQuery.current = null
  }

  function run(data: Account[], sql: string) {
    stopQuery()
    setBusy(true)
    setError('')
    setResult(undefined)
    const worker = new Worker(new URL('./explorer.worker.ts', import.meta.url), { type: 'module' })
    function finish(message: { result?: Result; error?: string }) {
      stopQuery()
      setResult(message.result)
      setError(message.error ?? '')
      setBusy(false)
    }
    activeQuery.current = {
      worker, timeout: window.setTimeout(() => finish({ error: 'Query timed out. Try a simpler SELECT.' }), 5000),
    }
    worker.onmessage = event => finish(event.data)
    worker.onerror = () => finish({ error: 'Could not start the SQL engine.' })
    worker.postMessage({ accounts: data, sql })
  }

  async function refresh(sql: string) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const data = await loadAccounts()
      setAccounts(data)
      run(data, sql)
    } catch {
      setError('Could not load the session from the workbench.')
      setBusy(false)
    }
  }

  useEffect(() => {
    let mounted = true
    loadAccounts().then(data => {
      if (!mounted) return
      setAccounts(data)
      run(data, initialQuery)
    }).catch(() => {
      if (!mounted) return
      setError('Could not load the session from the workbench.')
      setBusy(false)
    })
    return () => { mounted = false; stopQuery() }
  }, [])

  async function reset() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/reset', { method: 'POST', headers: { 'x-demo-action': 'reset' } })
      if (!response.ok) throw new Error()
      const { accounts: data } = await response.json() as { accounts: Account[] }
      setAccounts(data)
      setQuery(initialQuery)
      setNotice('Demo data reset. The six original accounts have been restored.')
      resetDialog.current?.close()
      run(data, initialQuery)
    } catch {
      resetDialog.current?.close()
      setError('Could not reset the demo data. Try again.')
      setBusy(false)
    }
  }

  return <>
    <header className="topbar"><div className="shell topbar-inner">
      <div className="brand"><span className="brand-icon"><Activity size={20} /></span> Activation Workbench</div>
      <SiteNav current="/data" />
    </div></header>
    <main className="shell">
      <div className="intro">
        <div className="context"><Database size={16} /> Session data</div>
        <h1>Data explorer</h1>
        <p>Browse the current demo session and run read-only SQLite queries on a snapshot.</p>
      </div>
      {notice && <p className="notice" role="status">{notice}</p>}
      <div className="explorer-layout">
        <aside className="panel explorer-sidebar" aria-labelledby="tables-heading">
          <h2 id="tables-heading">Tables</h2>
          {tables.map(table => <button key={table} className="table-button" disabled={busy || !accounts} onClick={() => {
            const sql = 'SELECT * FROM ' + table + ';'
            setQuery(sql)
            if (accounts) run(accounts, sql)
          }}><Database size={16} />{table}</button>)}
          <button className="reset-button" disabled={busy} onClick={() => resetDialog.current?.showModal()}>Reset demo data</button>
        </aside>
        <div className="explorer-main">
          <form className="panel explorer-panel" onSubmit={event => {
            event.preventDefault()
            if (accounts && !busy) run(accounts, query)
          }}>
            <h2><label htmlFor="sql-query">SQL query</label></h2>
            <textarea id="sql-query" className="sql-editor" rows={5} maxLength={8000} spellCheck={false} value={query} onChange={event => setQuery(event.target.value)} />
            <div className="explorer-actions">
              <button type="submit" className="primary" disabled={busy || !accounts}><Play size={16} /> Run query</button>
              <button type="button" className="secondary" disabled={busy} onClick={() => refresh(query)}><RefreshCw size={16} /> Refresh data</button>
            </div>
            {error && <p className="error" role="alert">{error}</p>}
          </form>
          <section className="panel explorer-panel" aria-labelledby="results-heading">
            <div className="section-heading"><h2 id="results-heading">Results</h2>
              {result && <p role="status">{result.rows.length} {result.rows.length === 1 ? 'row' : 'rows'}{result.truncated ? ' shown · limited to 100' : ''}</p>}</div>
            {busy && <p role="status">Loading…</p>}
            {result && !result.rows.length && <p>No rows match this query.</p>}
            {result && !!result.rows.length && <div className="result-scroll" tabIndex={0} role="region" aria-label="Scrollable SQL results">
              <table><thead><tr>{result.columns.map((column, index) => <th scope="col" key={index}>{column}</th>)}</tr></thead>
                <tbody>{result.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((value, index) =>
                  <td key={index}>{value === null ? <em>NULL</em> : value instanceof Uint8Array ? `BLOB (${value.length} bytes)` : String(value)}</td>)}</tr>)}</tbody></table>
            </div>}
          </section>
        </div>
      </div>
    </main>
    <dialog ref={resetDialog} aria-labelledby="reset-title" onCancel={event => { if (busy) event.preventDefault() }}>
      <h2 id="reset-title">Reset this demo session?</h2>
      <p className="mt-3">This removes your saved changes and restores the six original accounts.</p>
      <div className="dialog-actions">
        <button className="secondary" autoFocus disabled={busy} onClick={() => resetDialog.current?.close()}>Cancel</button>
        <button className="primary" disabled={busy} onClick={reset}>Restore seed data</button>
      </div>
    </dialog>
  </>
}
