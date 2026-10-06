// Script catalog: fetching from GitHub, caching, metadata parsing, search and execution.
import Fuse from './vendor/fuse.min.mjs'

export const DEFAULT_SOURCES = [
  { repo: 'wabiloo/floop', branch: 'main', path: 'Boop/Boop/scripts' },
  { repo: 'wabiloo/floop', branch: 'main', path: 'Scripts' },
]

// ---------- tiny IndexedDB key/value store ----------
let dbp
function db() {
  return (dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open('floop', 1)
    r.onupgradeneeded = () => r.result.createObjectStore('kv')
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  }))
}
export async function kvGet(k) {
  try {
    const d = await db()
    return await new Promise((res, rej) => {
      const q = d.transaction('kv').objectStore('kv').get(k)
      q.onsuccess = () => res(q.result)
      q.onerror = () => rej(q.error)
    })
  } catch { return undefined }
}
export async function kvSet(k, v) {
  try {
    const d = await db()
    await new Promise((res, rej) => {
      const t = d.transaction('kv', 'readwrite')
      t.objectStore('kv').put(v, k)
      t.oncomplete = res
      t.onerror = () => rej(t.error)
    })
  } catch { /* storage unavailable; the app still works for this session */ }
}

// ---------- GitHub sync ----------
export const sourceKey = s => `${s.repo}@${s.branch}:${s.path}`

async function ghJson(url, token) {
  const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} for ${url}`)
  return r.json()
}

async function pool(items, n, fn) {
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const item = items[i++]; await fn(item) }
  }))
}

// Returns { files: {relpath: {sha, code}}, syncedAt }. Unchanged blobs are reused from `prev`.
export async function fetchSource(src, token, prev, onProgress) {
  const base = src.path.replace(/^\/+|\/+$/g, '')
  const tree = await ghJson(
    `https://api.github.com/repos/${src.repo}/git/trees/${encodeURIComponent(src.branch)}?recursive=1`, token)
  const wanted = tree.tree.filter(e => e.type === 'blob' && e.path.endsWith('.js') &&
    (base === '' || e.path.startsWith(base + '/')))
  const files = {}
  let done = 0
  await pool(wanted, 8, async e => {
    const rel = base === '' ? e.path : e.path.slice(base.length + 1)
    const old = prev && prev.files[rel]
    if (old && old.sha === e.sha) files[rel] = old
    else {
      const url = token
        ? `https://api.github.com/repos/${src.repo}/contents/${e.path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(src.branch)}`
        : `https://raw.githubusercontent.com/${src.repo}/${src.branch}/${e.path.split('/').map(encodeURIComponent).join('/')}`
      const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.raw+json' } : {} })
      if (!r.ok) throw new Error(`${r.status} fetching ${e.path}`)
      files[rel] = { sha: e.sha, code: await r.text() }
    }
    onProgress && onProgress(++done, wanted.length)
  })
  return { files, syncedAt: Date.now() }
}

// ---------- parsing ----------
// Same rule as Boop: JSON between the first "/**" and the first "**/".
export function parseMeta(code) {
  const a = code.indexOf('/**'), b = code.indexOf('**/')
  if (a < 0 || b < 0 || b < a) return null
  try {
    const m = JSON.parse(code.slice(a + 3, b))
    return m && typeof m === 'object' && !Array.isArray(m) ? m : null
  } catch { return null }
}

// Build the script list from { sourceKey: {files} }. Only top-level .js files are scripts;
// everything else (lib/…) is module material.
export function buildScripts(caches) {
  const scripts = []
  for (const [key, cache] of Object.entries(caches)) {
    for (const [rel, f] of Object.entries(cache.files)) {
      if (rel.includes('/')) continue
      const meta = parseMeta(f.code)
      if (!meta) continue
      scripts.push({
        id: `${key}/${rel}`, source: key, file: rel, code: f.code,
        name: meta.name || rel.replace(/\.js$/, ''),
        description: meta.description || '', tags: meta.tags || '',
        icon: (meta.icon || '').toLowerCase(), bias: typeof meta.bias === 'number' ? meta.bias : 0,
        author: meta.author || '',
      })
    }
  }
  return scripts
}

// ---------- search (mirrors Boop's ScriptManager.search) ----------
export function makeSearch(scripts) {
  const fuse = new Fuse(scripts, {
    includeScore: true,
    threshold: 0.2,
    keys: [{ name: 'name', weight: 0.9 }, { name: 'tags', weight: 0.6 }, { name: 'description', weight: 0.2 }],
  })
  const byName = [...scripts].sort((a, b) => a.name.localeCompare(b.name))
  return query => {
    if (query === '*' || query.trim() === '') return byName
    if (query.length >= 20) return []
    return fuse.search(query)
      .filter(r => r.score < 0.4)
      .sort((l, r) => (l.score - l.item.bias) - (r.score - r.item.bias))
      .map(r => r.item)
  }
}

// ---------- execution ----------
const REQUIRE_RE = /require\(\s*(['"])([^'"]+)\1\s*\)/g
function normalise(p) {
  if (!p.endsWith('.js')) p += '.js'
  if (p.startsWith('@boop/')) p = 'lib/' + p.slice(6)
  return p.replace(/^\.\//, '')
}

// Collect every module a script (transitively) requires. Workers can't fetch synchronously,
// so we resolve statically and hand the sources over up front.
function collectModules(code, files) {
  const out = {}
  const visit = c => {
    for (const m of c.matchAll(REQUIRE_RE)) {
      const key = normalise(m[2])
      if (key in out || !files[key]) continue
      out[key] = files[key].code
      visit(files[key].code)
    }
  }
  visit(code)
  return out
}

const TIMEOUT_MS = 15000
const MAX_WORKERS = 8

export class Runner {
  constructor(getFiles) {
    this.getFiles = getFiles       // source key -> files map
    this.workers = new Map()       // script id -> { worker, ready, codeRef }
    this.runId = 0
  }
  reset() { for (const w of this.workers.values()) w.worker.terminate(); this.workers.clear() }

  _spawn(script) {
    const worker = new Worker('worker.js')
    const entry = { worker, codeRef: script.code }
    entry.ready = new Promise(res => {
      worker.onmessage = ({ data }) => res(data)
      worker.postMessage({
        type: 'load', name: script.name, code: script.code,
        modules: collectModules(script.code, this.getFiles(script.source)),
      })
    })
    this.workers.set(script.id, entry)
    if (this.workers.size > MAX_WORKERS) {
      const [oldId, old] = this.workers.entries().next().value
      old.worker.terminate(); this.workers.delete(oldId)
    }
    return entry
  }

  // -> { text, isSelection, insertOffset, messages: [{type, message}] }
  async run(script, { fullText, selection, insertIndex }) {
    let entry = this.workers.get(script.id)
    if (entry && entry.codeRef !== script.code) { entry.worker.terminate(); this.workers.delete(script.id); entry = null }
    if (entry) { this.workers.delete(script.id); this.workers.set(script.id, entry) } // LRU touch
    entry ||= this._spawn(script)
    const loaded = await entry.ready
    if (loaded.error) {
      entry.worker.terminate(); this.workers.delete(script.id)
      return { failed: true, messages: [{ type: 'error', message: loaded.error }] }
    }
    const runId = ++this.runId
    return new Promise(res => {
      const timer = setTimeout(() => {
        entry.worker.terminate(); this.workers.delete(script.id)
        res({ failed: true, messages: [{ type: 'error', message: `[${script.name}] Timed out after ${TIMEOUT_MS / 1000}s` }] })
      }, TIMEOUT_MS)
      entry.worker.onmessage = ({ data }) => {
        if (data.type !== 'result' || data.runId !== runId) return
        clearTimeout(timer)
        res({ ...data, text: data.text == null ? '' : String(data.text) })
      }
      entry.worker.onerror = e => {
        clearTimeout(timer)
        entry.worker.terminate(); this.workers.delete(script.id)
        res({ failed: true, messages: [{ type: 'error', message: `[${script.name}] ${e.message}` }] })
      }
      entry.worker.postMessage({ type: 'run', runId, fullText, selection, insertIndex })
    })
  }
}
