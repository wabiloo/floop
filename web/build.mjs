// Usage: node web/build.mjs <repo-root> <out-dir>
// Copies the web app to <out-dir> and snapshots the default script sources into
// scripts-bundle.json so the app works offline on first launch.
import { createHash } from 'node:crypto'
import { cpSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_SOURCES, sourceKey } from './scripts.js'

const webDir = fileURLToPath(new URL('.', import.meta.url))
const [root = '.', out = '_site'] = process.argv.slice(2)

function walk(dir) {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

mkdirSync(out, { recursive: true })
cpSync(webDir, out, { recursive: true, filter: p => !/build\.mjs$|README\.md$/.test(p) })

const sources = {}
for (const src of DEFAULT_SOURCES) {
  const dir = join(root, src.path)
  const files = {}
  for (const p of walk(dir)) {
    if (!p.endsWith('.js')) continue
    files[relative(dir, p).split('\\').join('/')] = { sha: '', code: readFileSync(p, 'utf8') }
  }
  sources[sourceKey(src)] = files
}
writeFileSync(join(out, 'scripts-bundle.json'), JSON.stringify({ builtAt: Date.now(), sources }))
// Stamp the service worker with a hash of everything it caches, so each deploy gets a fresh cache.
const hash = createHash('sha256')
for (const p of walk(out).sort()) if (!p.endsWith('sw.js')) hash.update(p).update(readFileSync(p))
const swPath = join(out, 'sw.js')
const build = hash.digest('hex').slice(0, 12)
for (const f of [swPath, join(out, 'index.html')]) writeFileSync(f, readFileSync(f, 'utf8').replaceAll('__BUILD__', build))
console.log(`Built ${out}: ${Object.values(sources).reduce((n, f) => n + Object.keys(f).length, 0)} script files`)
