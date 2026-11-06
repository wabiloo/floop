// Headless runner for Boop / Floop scripts. No dependencies.
//
// Mirrors web/worker.js (ScriptExecution, require/@boop resolution) and web/scripts.js
// (header parsing, script discovery, search), but runs scripts in a Node `vm` context
// instead of a Web Worker, so it can be used from a CLI or a Raycast extension.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve as resolvePath, posix } from 'node:path'
import vm from 'node:vm'

export const TIMEOUT_MS = 15000

// ---------- discovery ----------

// Same rule as Boop: JSON between the first "/**" and the first "**/".
export function parseMeta(code) {
  const a = code.indexOf('/**'), b = code.indexOf('**/')
  if (a < 0 || b < 0 || b < a) return null
  try {
    const m = JSON.parse(code.slice(a + 3, b))
    return m && typeof m === 'object' && !Array.isArray(m) ? m : null
  } catch { return null }
}

// Read every .js file under `dir` (recursively) into { 'rel/path.js': code }.
function readTree(dir, rel = '', out = {}) {
  for (const name of readdirSync(join(dir, rel))) {
    const r = rel ? `${rel}/${name}` : name
    const st = statSync(join(dir, r))
    if (st.isDirectory()) readTree(dir, r, out)
    else if (name.endsWith('.js')) out[r] = readFileSync(join(dir, r), 'utf8')
  }
  return out
}

/**
 * Load scripts from one or more folders. Like Floop, only top-level .js files with a
 * `/** {json} **\/` header are scripts; subfolders (lib/…) are module material and are
 * resolved per folder. Later folders override earlier ones with the same file name.
 */
export function loadScripts(dirs) {
  const scripts = []
  for (const dir of [].concat(dirs).filter(Boolean)) {
    const root = resolvePath(dir)
    let files
    try { files = readTree(root) } catch { continue }
    for (const [rel, code] of Object.entries(files)) {
      if (rel.includes('/')) continue
      const meta = parseMeta(code)
      if (!meta) continue
      const script = {
        id: `${root}/${rel}`, source: root, file: rel, code, files,
        name: meta.name || rel.replace(/\.js$/, ''),
        description: meta.description || '', tags: meta.tags || '',
        icon: (meta.icon || '').toLowerCase(),
        bias: typeof meta.bias === 'number' ? meta.bias : 0,
        author: meta.author || '',
      }
      const dup = scripts.findIndex(s => s.file === rel)
      if (dup >= 0) scripts.splice(dup, 1)
      scripts.push(script)
    }
  }
  // `@boop/x` resolves to lib/x.js from any source, as in Floop.
  const sharedLibs = {}
  for (const s of scripts) for (const [k, v] of Object.entries(s.files)) if (k.startsWith('lib/') && !(k in sharedLibs)) sharedLibs[k] = v
  for (const s of scripts) s.sharedLibs = sharedLibs
  return scripts.sort((a, b) => a.name.localeCompare(b.name))
}

const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')

/** Exact match on name or file name (ignoring case/spaces/punctuation), else best fuzzy match. */
export function findScript(scripts, query) {
  const q = norm(query)
  if (!q) return undefined
  return scripts.find(s => norm(s.name) === q || norm(s.file.replace(/\.js$/, '')) === q) ||
    search(scripts, query)[0]
}

/** Simple ranked search over name, tags and description (substring, then in-order letters). */
export function search(scripts, query) {
  const q = norm(query)
  if (!q) return scripts
  const scored = []
  for (const s of scripts) {
    const name = norm(s.name), tags = norm(s.tags), desc = norm(s.description)
    let score
    if (name.startsWith(q)) score = 0
    else if (name.includes(q)) score = 1
    else if (tags.includes(q)) score = 2
    else if (desc.includes(q)) score = 3
    else if (subsequence(q, name)) score = 4
    else continue
    scored.push([score - s.bias, s])
  }
  return scored.sort((a, b) => a[0] - b[0]).map(x => x[1])
}

function subsequence(q, s) {
  let i = 0
  for (const c of s) if (c === q[i]) i++
  return i === q.length
}

// ---------- execution ----------

class ScriptExecution {
  constructor(messages, selection, fullText, insertIndex) {
    this._messages = messages
    this.isSelection = selection !== null && selection !== undefined
    this.selection = this.isSelection ? selection : null
    this.fullText = fullText
    this.insertIndex = insertIndex
    this.insertOffset = 0
  }
  get text() { return this.isSelection ? this.selection : this.fullText }
  set text(v) { if (this.isSelection) this.selection = v; else this.fullText = v }
  postError(m) { this._messages.push({ type: 'error', message: String(m) }) }
  postInfo(m) { this._messages.push({ type: 'info', message: String(m) }) }
  insert(v) {
    v = String(v)
    if (this.isSelection) { this.selection = v; return }
    if (this.insertIndex == null || this.fullText == null) { this.fullText = v; return }
    const at = this.insertIndex + this.insertOffset
    this.fullText = this.fullText.slice(0, at) + v + this.fullText.slice(at)
    this.insertOffset += v.length
  }
}

function resolveModule(path) {
  if (!path.endsWith('.js')) path += '.js'
  if (path.startsWith('@boop/')) path = 'lib/' + path.slice(6)
  return posix.normalize(path.replace(/^\.\//, ''))
}

function fail(name, e) {
  return `[${name}] Error: ${e && e.message ? e.message : e}`
}

// One sandbox per script, kept alive between runs (like Boop's per-script JSContext).
const sandboxes = new WeakMap()

function createSandbox(script) {
  const messages = []
  const moduleCache = {}
  const boopRequire = path => {
    const key = resolveModule(String(path))
    if (key in moduleCache) return moduleCache[key].exports
    const code = script.files[key] ?? (key.startsWith('lib/') ? script.sharedLibs[key] : undefined)
    if (code === undefined) throw new Error(`Cannot find module '${path}'`)
    const module = { exports: {} }
    moduleCache[key] = module
    vm.runInContext(`(function (exports, module, require) {${code}\n})`, ctx, { filename: key })
      .call(module.exports, module.exports, module, boopRequire)
    return module.exports
  }
  const ctx = vm.createContext({
    console: { log() {}, info() {}, warn() {}, error() {}, debug() {} },
    TextEncoder, TextDecoder, atob, btoa, URL, URLSearchParams, structuredClone,
    ScriptExecution, require: boopRequire,
  })
  ctx.self = ctx   // workers/JSC expose `self`; there is deliberately no `window`
  const box = { ctx, messages }
  try {
    vm.runInContext(script.code, ctx, { filename: script.file, timeout: TIMEOUT_MS })
    if (vm.runInContext('typeof main', ctx) !== 'function') throw new Error('script does not define main()')
  } catch (e) {
    box.loadError = fail(script.name, e)
  }
  return box
}

/**
 * Run a script. Provide `selection` to act on a selection, or `fullText` (and optionally
 * `insertIndex`) to act on the whole text.
 * -> { text, isSelection, messages: [{type, message}], failed?: true }
 */
export function runScript(script, { fullText = '', selection = null, insertIndex = null, timeout = TIMEOUT_MS } = {}) {
  let box = sandboxes.get(script)
  if (!box) sandboxes.set(script, (box = createSandbox(script)))
  if (box.loadError) return { failed: true, text: '', messages: [{ type: 'error', message: box.loadError }] }
  box.messages.length = 0
  const exec = new ScriptExecution(box.messages, selection, fullText, insertIndex)
  box.ctx.__exec = exec
  let failed = false
  try {
    vm.runInContext('main(__exec)', box.ctx, { timeout })
  } catch (e) {
    failed = true
    const timedOut = e && e.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT'
    box.messages.push({ type: 'error', message: timedOut ? `[${script.name}] Timed out after ${timeout / 1000}s` : fail(script.name, e) })
    if (timedOut) sandboxes.delete(script)
  }
  const text = exec.text
  return {
    text: text == null ? '' : String(text),
    isSelection: exec.isSelection,
    messages: box.messages.map(m => ({ ...m })),
    ...(failed || box.messages.some(m => m.type === 'error') ? { failed: true } : {}),
  }
}

