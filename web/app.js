import { DEFAULT_SOURCES, sourceKey, fetchSource, buildScripts, makeSearch, Runner, kvGet, kvSet } from './scripts.js'

const $ = id => document.getElementById(id)
const ed = $('editor')
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v) } catch { return d } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private mode */ } },
}

// ---------- state ----------
let sources = ls.get('sources', DEFAULT_SOURCES)
let token = ls.get('token', '')
let caches = {}          // sourceKey -> { files, syncedAt }
let scripts = []
let search = () => []
let recent = ls.get('recent', [])
let lastScript = null
// A script sees its own source's files plus every source's lib/ (so @boop/* built-ins resolve everywhere).
const runner = new Runner(key => {
  const merged = {}
  for (const c of Object.values(caches)) for (const [p, f] of Object.entries(c.files)) if (p.startsWith('lib/')) merged[p] = f
  return Object.assign(merged, (caches[key] || { files: {} }).files)
})

// ---------- status ----------
let statusTimer
function setStatus(type, message) {
  const s = $('status')
  s.className = type; s.textContent = message
  clearTimeout(statusTimer)
  if (message) statusTimer = setTimeout(() => { s.textContent = ''; s.className = '' }, type === 'error' ? 10000 : 5000)
}

// ---------- undo history ----------
const hist = { stack: [], i: -1 }
function snap() { return { v: ed.value, s: ed.selectionStart, e: ed.selectionEnd } }
function pushHistory() {
  const cur = snap(), top = hist.stack[hist.i]
  if (top && top.v === cur.v) { top.s = cur.s; top.e = cur.e; return }
  hist.stack.length = hist.i + 1
  hist.stack.push(cur)
  if (hist.stack.length > 300) hist.stack.shift()
  hist.i = hist.stack.length - 1
  updateUndo()
}
function restore(n) {
  pushHistory()
  hist.i = Math.max(0, Math.min(hist.stack.length - 1, n))
  const h = hist.stack[hist.i]
  ed.value = h.v; ed.setSelectionRange(h.s, h.e)
  persistText(); updateUndo()
}
function updateUndo() {
  $('undo').disabled = hist.i <= 0
  $('redo').disabled = hist.i >= hist.stack.length - 1
}
let typeTimer
ed.addEventListener('input', () => { clearTimeout(typeTimer); typeTimer = setTimeout(pushHistory, 700); persistText() })
$('undo').onclick = () => { pushHistory(); restore(hist.i - 1) }
$('redo').onclick = () => restore(hist.i + 1)
function persistText() { ls.set('draft', ed.value) }

// ---------- running scripts ----------
function setText(value, selStart, selEnd) {
  ed.value = value
  ed.setSelectionRange(selStart, selEnd)
}

async function runScript(script, opts = {}) {
  lastScript = script
  $('again').disabled = false
  recent = [script.id, ...recent.filter(x => x !== script.id)].slice(0, 8)
  ls.set('recent', recent)

  clearTimeout(typeTimer)
  pushHistory()
  const full = ed.value
  const s = ed.selectionStart, e = ed.selectionEnd
  const hasSel = e > s
  setStatus('', '')
  const res = await runner.run(script, {
    fullText: full, selection: hasSel ? full.slice(s, e) : null, insertIndex: s,
  })
  for (const m of res.messages || []) setStatus(m.type, m.message)
  if (res.failed) return null

  if (res.isSelection) {
    setText(full.slice(0, s) + res.text + full.slice(e), s, s + res.text.length)
  } else {
    const caret = res.insertOffset ? s + res.insertOffset : Math.min(s, res.text.length)
    setText(res.text, caret, caret)
  }
  pushHistory(); persistText()
  return res.text
}

$('again').onclick = () => lastScript && runScript(lastScript)

// ---------- clipboard ----------
$('copy').onclick = async () => {
  const s = ed.selectionStart, e = ed.selectionEnd
  const text = e > s ? ed.value.slice(s, e) : ed.value
  try { await navigator.clipboard.writeText(text); setStatus('success', e > s ? 'Copied selection' : 'Copied all') }
  catch { ed.focus(); setStatus('error', 'Clipboard blocked: select the text and copy manually') }
}
$('paste').onclick = async () => {
  try {
    const t = await navigator.clipboard.readText()
    pushHistory()
    const s = ed.selectionStart, e = ed.selectionEnd
    if (e > s) setText(ed.value.slice(0, s) + t + ed.value.slice(e), s, s + t.length)
    else setText(t, t.length, t.length)
    pushHistory(); persistText()
  } catch { ed.focus(); setStatus('error', 'Clipboard blocked: long-press the editor and choose Paste') }
}

// ---------- overlays sized to the visual viewport (so they sit above the keyboard) ----------
function syncViewport() {
  const v = window.visualViewport
  if (!v) return
  document.documentElement.style.setProperty('--vvh', v.height + 'px')
  document.documentElement.style.setProperty('--vvt', v.offsetTop + 'px')
}
if (window.visualViewport) { visualViewport.addEventListener('resize', syncViewport); visualViewport.addEventListener('scroll', syncViewport) }
syncViewport()

// ---------- picker ----------
const picker = $('picker'), q = $('query'), results = $('results')
let shown = [], sel = 0

function openPicker() { picker.hidden = false; q.value = ''; renderResults(); q.focus() }
function closePicker() { picker.hidden = true; q.blur() }

function renderResults() {
  const query = q.value.trim()
  if (query === '') {
    const byId = new Map(scripts.map(s => [s.id, s]))
    const rec = recent.map(id => byId.get(id)).filter(Boolean)
    shown = [...rec, ...search('*').filter(s => !rec.includes(s))]
  } else shown = search(query)
  sel = 0
  results.replaceChildren()
  if (!shown.length) {
    const d = document.createElement('div'); d.className = 'empty'
    d.textContent = scripts.length ? 'No matching scripts' : 'No scripts loaded: open Settings and sync'
    results.append(d); return
  }
  shown.slice(0, 200).forEach((s, i) => {
    const el = document.createElement('div')
    el.className = 'item' + (i === 0 ? ' sel' : '')
    el.setAttribute('role', 'option')
    const b = document.createElement('div'); b.className = 'badge'; b.textContent = (s.name[0] || '?').toUpperCase()
    const t = document.createElement('div'); t.className = 't'
    const n = document.createElement('div'); n.className = 'n'; n.textContent = s.name
    const d = document.createElement('div'); d.className = 'd'; d.textContent = s.description
    t.append(n, d); el.append(b, t)
    el.onclick = () => choose(s)
    results.append(el)
  })
  results.scrollTop = 0
}
function choose(s) { closePicker(); runScript(s) }
function moveSel(d) {
  const items = results.querySelectorAll('.item')
  if (!items.length) return
  items[sel]?.classList.remove('sel')
  sel = Math.max(0, Math.min(items.length - 1, sel + d))
  items[sel].classList.add('sel'); items[sel].scrollIntoView({ block: 'nearest' })
}
q.addEventListener('input', renderResults)
q.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); if (shown[sel]) choose(shown[sel]) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); moveSel(1) }   // list is reversed: up = further away
  else if (e.key === 'ArrowDown') { e.preventDefault(); moveSel(-1) }
  else if (e.key === 'Escape') closePicker()
})
picker.querySelector('.scrim').onclick = closePicker
$('scriptsBtn').onclick = openPicker

// ---------- settings ----------
const settings = $('settings')
function renderSources() {
  const box = $('sources'); box.replaceChildren()
  sources.forEach((s, i) => {
    const wrap = document.createElement('div'); wrap.className = 'src'
    const repo = document.createElement('input'); repo.value = `${s.repo}@${s.branch}`; repo.placeholder = 'owner/repo@branch'
    const path = document.createElement('input'); path.className = 'path'; path.value = s.path; path.placeholder = 'folder/with/scripts'
    const rm = document.createElement('button'); rm.textContent = 'Remove'
    const commit = () => {
      const [r, b] = repo.value.trim().split('@')
      sources[i] = { repo: r, branch: b || 'main', path: path.value.trim() }
      ls.set('sources', sources)
    }
    repo.onchange = path.onchange = commit
    rm.onclick = () => { sources.splice(i, 1); ls.set('sources', sources); renderSources() }
    wrap.append(repo, rm, path); box.append(wrap)
  })
}
function updateSyncInfo(extra) {
  const times = Object.values(caches).map(c => c.syncedAt).filter(Boolean)
  const when = times.length ? new Date(Math.max(...times)).toLocaleString() : 'never'
  $('syncInfo').textContent = `${scripts.length} scripts · last synced ${when}${extra ? ' · ' + extra : ''}`
}
$('settingsBtn').onclick = () => { settings.hidden = false; renderSources(); $('token').value = token; updateSyncInfo(); updateLink() }
$('closeSettings').onclick = () => { settings.hidden = true }
settings.querySelector('.scrim').onclick = () => { settings.hidden = true }
$('addSource').onclick = () => { sources.push({ repo: '', branch: 'main', path: '' }); renderSources() }
$('resetSources').onclick = () => { sources = structuredClone(DEFAULT_SOURCES); ls.set('sources', sources); renderSources() }
$('token').onchange = e => { token = e.target.value.trim(); ls.set('token', token) }
$('sync').onclick = () => sync(true)

function rebuild() {
  scripts = buildScripts(caches)
  search = makeSearch(scripts)
  runner.reset()
  const ids = new Set(scripts.map(s => s.id))
  recent = recent.filter(id => ids.has(id))
  if (lastScript && !ids.has(lastScript.id)) lastScript = null
}

let syncing = false
async function sync(manual) {
  if (syncing) return
  syncing = true
  const btn = $('sync'); btn.disabled = true
  const valid = sources.filter(s => s.repo && s.repo.includes('/'))
  const next = {}
  const errors = []
  for (const src of valid) {
    const key = sourceKey(src)
    try {
      next[key] = await fetchSource(src, token, caches[key], (d, n) => {
        const msg = `Syncing ${src.repo}: ${d}/${n}`
        manual ? ($('syncInfo').textContent = msg) : setStatus('info', msg)
      })
    } catch (e) {
      errors.push(`${src.repo}/${src.path}: ${e.message}`)
      if (caches[key]) next[key] = caches[key]   // keep what we had
    }
  }
  // Drop caches for sources that no longer exist; keep cached copy for sources that failed.
  if (Object.keys(next).length) {
    caches = next
    await kvSet('caches', caches)
    rebuild()
  }
  syncing = false; btn.disabled = false
  if (errors.length) { setStatus('error', 'Sync failed: ' + errors[0]); updateSyncInfo(errors.join('; ')) }
  else { setStatus('success', `Synced ${scripts.length} scripts`); updateSyncInfo() }
}

// ---------- Shortcuts / deep links ----------
function updateLink() {
  const base = location.origin + location.pathname
  $('linkEx').textContent = `${base}#script=Base64%20Encode&text=hello&copy=1`
}
$('copyLink').onclick = async () => {
  const name = $('linkScript').value.trim() || 'Script Name'
  const url = `${location.origin}${location.pathname}#script=${encodeURIComponent(name)}&text=`
  try { await navigator.clipboard.writeText(url); setStatus('success', 'Link template copied') } catch { setStatus('error', 'Clipboard blocked') }
}

function fromB64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='
  return new TextDecoder().decode(Uint8Array.from(atob(s), c => c.charCodeAt(0)))
}
function findScript(name) {
  const n = name.toLowerCase()
  return scripts.find(s => s.name.toLowerCase() === n) ||
    scripts.find(s => s.file.toLowerCase() === n || s.file.toLowerCase() === n + '.js')
}
async function handleHash() {
  if (location.hash.length <= 1) return
  const p = new URLSearchParams(location.hash.slice(1))
  if (![...p.keys()].length) return
  history.replaceState(null, '', location.pathname + location.search)
  let text = p.has('b64') ? fromB64url(p.get('b64')) : p.get('text')
  if (text != null) { pushHistory(); setText(text, text.length, text.length); persistText() }
  const name = p.get('script')
  if (name) {
    const s = findScript(name)
    if (!s) return setStatus('error', `No script named "${name}"`)
    ed.setSelectionRange(0, 0)
    const out = await runScript(s)
    if (out == null) return
    if (p.get('copy') === '1') { try { await navigator.clipboard.writeText(out) } catch { setStatus('error', 'Result ready; tap Copy (clipboard needs a tap)') } }
    const cb = p.get('callback')
    if (cb) location.href = cb.replace('{result}', encodeURIComponent(out))
  } else if (p.get('picker') === '1') openPicker()
}
addEventListener('hashchange', handleHash)

// ---------- boot ----------
async function loadBundled() {
  try {
    const r = await fetch('scripts-bundle.json')
    if (!r.ok) return null
    return await r.json()
  } catch { return null }
}

async function boot() {
  const draft = ls.get('draft', '')
  if (draft) ed.value = draft
  hist.stack = [snap()]; hist.i = 0; updateUndo()

  caches = (await kvGet('caches')) || {}
  const want = new Set(sources.map(sourceKey))
  const have = Object.keys(caches).filter(k => want.has(k))
  if (!have.length) {
    // First run (or offline): the snapshot that shipped with this site.
    const bundled = await loadBundled()
    if (bundled) {
      for (const [k, files] of Object.entries(bundled.sources || {})) {
        if (want.has(k)) caches[k] = { files, syncedAt: bundled.builtAt || 0 }
      }
    }
  }
  rebuild()
  if (location.hash.length > 1) await handleHash()
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {})
  if (navigator.onLine) sync(false)
}
boot()
