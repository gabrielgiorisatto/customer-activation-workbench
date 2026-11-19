import { readFile, readdir, mkdir, copyFile, cp } from 'node:fs/promises'
import { rolldown } from 'rolldown'

const assets = { '/': ['text/html; charset=utf-8', await readFile('dist/client/index.html', 'utf8')] }
for (const file of await readdir('dist/client/assets')) {
  const type = file.endsWith('.css') ? 'text/css' : 'text/javascript'
  assets['/assets/' + file] = [type, await readFile('dist/client/assets/' + file, 'utf8')]
}
const bundle = await rolldown({
  input: 'virtual:worker',
  plugins: [{
    name: 'embed-vite-assets',
    resolveId(id) {
      if (id === 'virtual:worker') return '\0' + id
      if (id === 'workbench-api') return new URL('../server/api.ts', import.meta.url).pathname
    },
    load(id) {
      if (id !== '\0virtual:worker') return
      return `
        import { api } from 'workbench-api'
        const assets = ${JSON.stringify(assets)}
        export default {
          async fetch(request, env) {
            const { pathname } = new URL(request.url)
            if (pathname.startsWith('/api/')) {
              try { return await api(request, env.DB) }
              catch (error) {
                console.error(error)
                return Response.json({ errors: { form: 'Storage is temporarily unavailable. Try again.' } }, { status: 503 })
              }
            }
            const assetPath = ['/data', '/data/', '/guide', '/guide/'].includes(pathname) ? '/' : pathname
            const asset = Object.hasOwn(assets, assetPath) ? assets[assetPath] : null
            if (!asset) return new Response('Not found', { status: 404 })
            return new Response(asset[1], { headers: {
              'content-type': asset[0],
              'cache-control': assetPath === '/' ? 'no-cache' : 'public, max-age=31536000, immutable',
            } })
          },
        }`
    },
  }],
})
await bundle.write({ file: 'dist/server/index.js', format: 'esm' })
await bundle.close()
await mkdir('dist/.openai', { recursive: true })
await copyFile('.openai/hosting.json', 'dist/.openai/hosting.json')
await cp('drizzle', 'dist/drizzle', { recursive: true })
