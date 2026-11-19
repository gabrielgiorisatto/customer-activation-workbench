import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { api, type Database } from './server/api.ts'

export default defineConfig({
  plugins: [react(), tailwind(), {
    name: 'local-demo-database',
    async configureServer(server) {
      const { DatabaseSync } = await import('node:sqlite')
      const sqlite = new DatabaseSync('activation.sqlite')
      sqlite.exec(readFileSync('drizzle/0000_sessions.sql', 'utf8').replace('CREATE TABLE', 'CREATE TABLE IF NOT EXISTS'))
      const db: Database = { prepare: sql => ({ bind: (...values) => ({
        first: async <T>() => (sqlite.prepare(sql).get(...values) as T | undefined) ?? null,
        run: async () => ({ meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } }),
      }) }) }
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(Buffer.from(chunk))
          const response = await api(new Request(new URL(req.url, 'http://localhost'), {
            method: req.method,
            headers: Object.fromEntries(Object.entries(req.headers).map(([key, value]) => [key, String(value)])),
            body: ['PATCH', 'POST'].includes(req.method ?? '') ? Buffer.concat(chunks).toString() : undefined,
          }), db)
          res.writeHead(response.status, Object.fromEntries(response.headers))
          res.end(await response.text())
        } catch (error) { next(error) }
      })
      server.httpServer?.once('close', () => sqlite.close())
    },
  }],
  build: { outDir: 'dist/client' },
})
