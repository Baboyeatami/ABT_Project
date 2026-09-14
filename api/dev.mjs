// Local API server. Mirrors Vercel's /api rewrite.
// Run: node api/dev.mjs  (listens on :3001, Vite proxies /api here)
import { readFileSync } from 'node:fs'

for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const { default: app } = await import('./index.js')

const port = process.env.PORT || 3001
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})
