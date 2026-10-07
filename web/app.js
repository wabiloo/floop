import { DEFAULT_SOURCES, sourceKey, fetchSource, buildScripts, makeSearch, parseMeta, Runner, kvGet, kvSet } from './scripts.js'

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
let local = { files: {} } // scripts created or imported in the app, kept on this device
let scripts = []
let search = () => []
let recent = ls.get('recent', [])
let favs = new Set(ls.get('favs', []))   // script ids
let favOnly = ls.get('favOnly', false)
let lastScript = null
const AI_DEFAULTS = { anthropic: 'claude-sonnet-5-5', openai: 'gpt-4o' }
let ai = ls.get('ai', { keys: {}, models: {} })
const aiModel = p => (ai.models[p] || '').trim() || AI_DEFAULTS[p]
// A script sees its own source's files plus every source's lib/ (so @boop/* built-ins resolve everywhere).
const runner = new Runner(key => {
  const merged = {}
  for (const c of Object.values(caches)) for (const [p, f] of Object.entries(c.files)) if (p.startsWith('lib/')) merged[p] = f
  return Object.assign(merged, (key === 'local' ? local : caches[key] || { files: {} }).files)
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
$('clear').onclick = () => {
  if (!ed.value) return ed.focus()
  clearTimeout(typeTimer); pushHistory()      // so ↶ brings it back
  setText('', 0, 0); pushHistory(); persistText(); ed.focus()
  setStatus('info', 'Cleared (↶ to undo)')
}
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

// ---------- keep the layout inside the visual viewport (above the keyboard) ----------
function syncViewport() {
  const v = window.visualViewport
  if (!v) return
  document.documentElement.style.setProperty('--vvh', v.height + 'px')
  document.documentElement.style.setProperty('--vvt', v.offsetTop + 'px')
  document.documentElement.classList.toggle('kb', window.innerHeight - v.height > 120)
  if (v.offsetLeft || window.scrollX) window.scrollTo(0, 0)   // undo any focus-induced page pan
}
if (window.visualViewport) { visualViewport.addEventListener('resize', syncViewport); visualViewport.addEventListener('scroll', syncViewport) }
syncViewport()

// ---------- script list (always visible in the footer) ----------
const q = $('query'), results = $('results')
let shown = [], sel = 0

function renderResults() {
  const query = q.value.trim()
  if (query === '') {
    const byId = new Map(scripts.map(s => [s.id, s]))
    const rec = recent.map(id => byId.get(id)).filter(Boolean)
    shown = [...rec, ...search('*').filter(s => !rec.includes(s))]
  } else shown = search(query)
  if (favOnly) shown = shown.filter(s => favs.has(s.id))
  sel = 0
  results.replaceChildren()
  if (!shown.length) {
    const d = document.createElement('div'); d.className = 'empty'
    d.textContent = favOnly && scripts.length ? (q.value.trim() ? 'No matching favourites' : 'No favourites yet: tap a star, or turn the filter off') : scripts.length ? 'No matching scripts' : 'No scripts loaded: open Settings and sync'
    results.append(d); return
  }
  shown.slice(0, 200).forEach((s, i) => {
    const el = document.createElement('div')
    el.className = 'item' + (i === 0 && query ? ' sel' : '')
    el.setAttribute('role', 'option')
    const n = document.createElement('div'); n.className = 'n'; n.textContent = s.name
    const d = document.createElement('div'); d.className = 'd'; d.textContent = (s.source === 'local' ? 'On this device · ' : '') + s.description
    const txt = document.createElement('div'); txt.className = 't'; txt.append(n, d)
    const star = document.createElement('button'); star.className = 'star' + (favs.has(s.id) ? ' on' : '')
    star.setAttribute('aria-label', 'Favourite'); star.setAttribute('aria-pressed', favs.has(s.id))
    star.innerHTML = `<svg class="i"><use href="#i-star${favs.has(s.id) ? '-fill' : ''}"/></svg>`
    star.addEventListener('pointerdown', e => e.preventDefault())
    star.onclick = e => {
      e.stopPropagation()
      favs.has(s.id) ? favs.delete(s.id) : favs.add(s.id)
      ls.set('favs', [...favs])
      const on = favs.has(s.id)
      star.classList.toggle('on', on); star.setAttribute('aria-pressed', on)
      star.firstChild.firstChild.setAttribute('href', on ? '#i-star-fill' : '#i-star')
      if (favOnly && !on) renderResults()
    }
    el.append(txt, star)
    // Keep the editor focused/selected: don't let the tap steal focus before we run.
    el.addEventListener('pointerdown', e => e.preventDefault())
    el.onclick = () => choose(s)
    results.append(el)
  })
  results.scrollTop = 0
}
function choose(s) {
  q.value = ''; q.blur()
  runScript(s).then(renderResults)
}
function moveSel(d) {
  const items = results.querySelectorAll('.item')
  if (!items.length) return
  items[sel]?.classList.remove('sel')
  sel = Math.max(0, Math.min(items.length - 1, sel + d))
  items[sel].classList.add('sel'); items[sel].scrollIntoView({ block: 'nearest' })
}
function syncFavBtn() {
  const b = $('favOnly')
  b.classList.toggle('on', favOnly); b.setAttribute('aria-pressed', favOnly)
  b.firstChild.firstChild.setAttribute('href', favOnly ? '#i-star-fill' : '#i-star')
}
$('favOnly').addEventListener('pointerdown', e => e.preventDefault())
$('favOnly').onclick = () => { favOnly = !favOnly; ls.set('favOnly', favOnly); syncFavBtn(); renderResults() }
syncFavBtn()
q.addEventListener('input', renderResults)
q.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); if (shown[sel]) choose(shown[sel]) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); moveSel(1) }   // list is reversed: up = further away
  else if (e.key === 'ArrowDown') { e.preventDefault(); moveSel(-1) }
  else if (e.key === 'Escape') { q.value = ''; q.blur(); renderResults() }
})

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
function updateSubs() {
  const n = Object.keys(local.files).length
  $('subSources').textContent = `${scripts.length} scripts`
  $('subMine').textContent = n ? `${n} on this device` : ''
  $('subAi').textContent = [ai.keys.anthropic && 'Claude', ai.keys.openai && 'ChatGPT'].filter(Boolean).join(' · ') || 'Not set'
}
function updateSyncInfo(extra) {
  updateSubs()
  const times = Object.values(caches).map(c => c.syncedAt).filter(Boolean)
  const when = times.length ? new Date(Math.max(...times)).toLocaleString() : 'never'
  $('syncInfo').textContent = `${scripts.length} scripts · last synced ${when}${extra ? ' · ' + extra : ''}`
}
$('settingsBtn').onclick = () => { settings.hidden = false; renderSources(); renderLocal(); $('token').value = token; updateSyncInfo(); updateLink() }
$('closeSettings').onclick = () => { settings.hidden = true }
settings.querySelector('.scrim').onclick = () => { settings.hidden = true }
$('addSource').onclick = () => { sources.push({ repo: '', branch: 'main', path: '' }); renderSources() }
$('resetSources').onclick = () => { sources = structuredClone(DEFAULT_SOURCES); ls.set('sources', sources); renderSources() }
$('token').onchange = e => { token = e.target.value.trim(); ls.set('token', token) }
$('sync').onclick = () => sync(true)

function rebuild() {
  scripts = buildScripts({ ...caches, local })
  search = makeSearch(scripts)
  runner.reset()
  const ids = new Set(scripts.map(s => s.id))
  recent = recent.filter(id => ids.has(id))
  if (typeof renderResults === 'function') try { renderResults() } catch { /* before first paint */ }
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


// ---------- your own scripts (on-device, optionally published to GitHub) ----------
const TEMPLATE = `/**
  {
    "api": 1,
    "name": "My Script",
    "description": "What it does",
    "author": "",
    "icon": "metamorphose",
    "tags": "my,script"
  }
**/

function main(state) {
  state.text = state.text.toUpperCase()
}
`
const sheet = $('scriptEditor'), codeArea = $('ceCode'), ceOut = $('ceOut'), ceMsg = $('ceMsg')
let editing = null   // { file } of the local script being edited, or null for a new one

function renderLocal() {
  const box = $('localList'); box.replaceChildren()
  const names = Object.keys(local.files).sort()
  if (!names.length) { const p = document.createElement('p'); p.className = 'hint'; p.textContent = 'No scripts of your own yet.'; box.append(p); return }
  for (const file of names) {
    const meta = scripts.find(s => s.id === 'local/' + file)
    const row = document.createElement('div'); row.className = 'lrow'
    const t = document.createElement('span'); t.textContent = meta ? meta.name : file
    const b = document.createElement('button'); b.textContent = 'Edit'
    b.onclick = () => openScriptEditor(file)
    row.append(t, b); box.append(row)
  }
}

function openScriptEditor(file, code) {
  editing = file ? { file } : null
  codeArea.value = code ?? (file ? local.files[file].code : TEMPLATE)
  $('ceTitle').textContent = file ? 'Edit script' : 'New script'
  $('ceDelete').hidden = !file
  $('cePublish').hidden = !token; $('pubRow').hidden = !token
  const pt = $('pubTarget'); pt.replaceChildren(...sources.filter(s => s.repo.includes('/')).map((s, i) => new Option(`${s.repo}@${s.branch}/${s.path}`, i)))
  pt.value = pt.options.length - 1   // default to the last source (the custom-scripts folder in the defaults)
  $('askText').value = ''; $('ask').open = !file && code === undefined
  ceOut.textContent = ''; ceMsg.textContent = ''; ceMsg.className = 'hint'
  sheet.hidden = false
  if (!file && code === undefined) { codeArea.focus(); codeArea.setSelectionRange(0, 0) }
}
const ceSay = (type, m) => { ceMsg.textContent = m; ceMsg.className = 'hint ' + type }

function checkCode() {
  const meta = parseMeta(codeArea.value)
  if (!meta) { ceSay('error', 'The header must be valid JSON between /** and **/'); return null }
  if (!meta.name) { ceSay('error', 'The header needs a "name"'); return null }
  if (!/function\s+main\s*\(|\bmain\s*=/.test(codeArea.value)) { ceSay('error', 'The script needs a main(state) function'); return null }
  return meta
}
const fileNameFor = name => (name.replace(/[^A-Za-z0-9 _.-]+/g, '').trim().replace(/\s+/g, '') || 'Script').replace(/\.js$/, '') + '.js'

$('ceTest').onclick = async () => {
  const meta = checkCode(); if (!meta) return
  const script = { id: 'local/__test.js', source: 'local', file: '__test.js', name: meta.name, code: codeArea.value }
  ceOut.textContent = '…'
  const full = ed.value, s = ed.selectionStart, e = ed.selectionEnd
  const res = await runner.run(script, { fullText: full, selection: e > s ? full.slice(s, e) : null, insertIndex: s })
  runner.drop(script.id)
  ceOut.textContent = res.failed ? '' : res.text
  const err = (res.messages || []).find(m => m.type === 'error')
  if (err) ceSay('error', err.message)
  else ceSay('success', (res.messages || []).map(m => m.message).join(' · ') || 'Ran on your editor text (not applied)')
}

$('ceSave').onclick = async () => {
  const meta = checkCode(); if (!meta) return
  let file = editing ? editing.file : fileNameFor(meta.name)
  if (!editing) {
    const base = file.replace(/\.js$/, '')
    for (let i = 2; file in local.files; i++) file = `${base}-${i}.js`
  }
  local.files[file] = { sha: '', code: codeArea.value }
  await kvSet('local', local)
  rebuild(); renderLocal()
  sheet.hidden = true
  setStatus('success', `Saved "${meta.name}" on this device`)
}

$('ceDelete').onclick = async () => {
  if (!editing || !confirm('Delete this script from this device?')) return
  delete local.files[editing.file]
  favs.delete('local/' + editing.file); ls.set('favs', [...favs])
  await kvSet('local', local)
  rebuild(); renderLocal(); sheet.hidden = true
  setStatus('success', 'Script deleted')
}
$('ceCancel').onclick = () => { sheet.hidden = true }
sheet.querySelector('.scrim').onclick = () => { sheet.hidden = true }
$('newScript').onclick = () => openScriptEditor()


// ---------- "Ask an AI": copy a ready-made prompt, paste the reply back ----------
const SPEC = `You write scripts for Boop, a text-transformation tool. A script is a single JavaScript file with this exact shape:

/**
  {
    "api": 1,
    "name": "Short Name",
    "description": "One sentence on what it does",
    "author": "",
    "icon": "metamorphose",
    "tags": "comma,separated,search,words"
  }
**/

function main(state) {
  // transform state.text and assign it back
}

Rules:
- The header comment must be valid JSON (double quotes, no trailing commas) between "/**" and "**/".
- "state" has: state.text (the selection if there is one, otherwise the whole text: read and assign it), state.fullText (always the whole text), state.selection, state.isSelection, state.insert(str) (insert at the caret), state.postInfo(msg) (show a short message), state.postError(msg) (show an error).
- Plain vanilla JavaScript only. No DOM, no window, no Node APIs, no import/export, no fetch.
- Built-in helpers can be loaded with require: '@boop/base64' ({encode, decode}), '@boop/he' (HTML entities), '@boop/lodash.boop' (camelCase, kebabCase, snakeCase, startCase, deburr, escapeRegExp, size), '@boop/vkBeautify' (xml, css, sql and their *min versions), '@boop/js-yaml', '@boop/hashes', '@boop/papaparse.js'.
- On bad input, call state.postError("…") and leave state.text unchanged.
- Reply with the complete script in one code block and nothing else.`

function userRequest(req) {
  const cur = codeArea.value.trim() && codeArea.value !== TEMPLATE
    ? `\n\nHere is my current version, which you should modify:\n\n${codeArea.value}` : ''
  return `Write a Boop script that does this: ${req}${cur}`
}
const stripFence = t => { const f = t.match(/```[a-zA-Z]*\n([\s\S]*?)```/); return (f ? f[1] : t).trim() + '\n' }

async function askModel(provider, req) {
  const key = ai.keys[provider], model = aiModel(provider), user = userRequest(req)
  if (provider === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: {
      'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model, max_tokens: 4096, system: SPEC, messages: [{ role: 'user', content: user }] }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error((j.error && j.error.message) || `${r.status} ${r.statusText}`)
    return (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('')
  }
  const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: {
    'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, max_completion_tokens: 4096, messages: [{ role: 'system', content: SPEC }, { role: 'user', content: user }] }) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((j.error && j.error.message) || `${r.status} ${r.statusText}`)
  return (j.choices && j.choices[0] && j.choices[0].message.content) || ''
}

async function generate(provider) {
  const req = $('askText').value.trim()
  if (!req) return ceSay('error', 'Describe what the script should do first')
  const btn = $(provider === 'anthropic' ? 'genAnthropic' : 'genOpenai')
  const label = btn.textContent
  document.querySelectorAll('#askGen button').forEach(b => { b.disabled = true })
  btn.textContent = 'Writing…'; ceSay('info', 'Asking the model…')
  try {
    const code = stripFence(await askModel(provider, req))
    if (!parseMeta(code)) throw new Error("the reply didn't contain a Boop script")
    codeArea.value = code
    $('ask').open = false
    ceSay('info', 'Written. Tap Test to try it on your text, then Save.')
  } catch (e) { ceSay('error', 'AI request failed: ' + e.message) }
  finally { btn.textContent = label; document.querySelectorAll('#askGen button').forEach(b => { b.disabled = false }) }
}
$('genAnthropic').onclick = () => generate('anthropic')
$('genOpenai').onclick = () => generate('openai')

function syncAiButtons() {
  $('genAnthropic').hidden = !ai.keys.anthropic
  $('genOpenai').hidden = !ai.keys.openai
  $('askGen').hidden = !(ai.keys.anthropic || ai.keys.openai)
  $('askGen').style.display = $('askGen').hidden ? 'none' : ''
  $('askNoKey').hidden = !!(ai.keys.anthropic || ai.keys.openai)
}
for (const p of ['anthropic', 'openai']) {
  const P = p[0].toUpperCase() + p.slice(1)
  const key = $('key' + P), model = $('model' + P)
  key.value = ai.keys[p] || ''; model.value = ai.models[p] || ''; model.placeholder = AI_DEFAULTS[p]
  key.onchange = () => { ai.keys[p] = key.value.trim(); ls.set('ai', ai); syncAiButtons() }
  model.onchange = () => { ai.models[p] = model.value.trim(); ls.set('ai', ai) }
}
syncAiButtons()

$('askCopy').onclick = async () => {
  const req = $('askText').value.trim()
  if (!req) return ceSay('error', 'Describe what the script should do first')
  const prompt = `${SPEC}\n\n${userRequest(req)}`
  try { await navigator.clipboard.writeText(prompt); ceSay('success', 'Prompt copied. Paste it into your AI app, then come back and tap "Paste reply".') }
  catch { ceSay('error', 'Clipboard blocked. Tap again, or allow clipboard access.') }
}

$('askPaste').onclick = async () => {
  let t
  try { t = await navigator.clipboard.readText() } catch { return ceSay('error', 'Clipboard blocked. Long-press the code box and choose Paste instead.') }
  const code = stripFence(t)
  if (!parseMeta(code)) return ceSay('error', "That doesn't look like a Boop script (no /** {json} **/ header). Copy the AI's whole reply and try again.")
  if (codeArea.value.trim() && codeArea.value !== TEMPLATE && !confirm('Replace the code in the editor?')) return
  codeArea.value = code
  $('ask').open = false
  ceSay('info', 'Pasted. Tap Test to try it on your text, then Save.')
}

// Publish: commit the script into one of the configured GitHub sources (needs a token with write access).
$('cePublish').onclick = async () => {
  const meta = checkCode(); if (!meta) return
  const targets = sources.filter(s => s.repo.includes('/'))
  if (!targets.length) return ceSay('error', 'Add a script source in Settings first')
  const target = targets[Math.min(+$('pubTarget').value || 0, targets.length - 1)]
  const file = editing ? editing.file : fileNameFor(meta.name)
  const path = [target.path.replace(/^\/+|\/+$/g, ''), file].filter(Boolean).join('/')
  const url = `https://api.github.com/repos/${target.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
  $('cePublish').disabled = true; ceSay('info', 'Publishing…')
  try {
    let sha
    const cur = await fetch(`${url}?ref=${encodeURIComponent(target.branch)}`, { headers })
    if (cur.ok) {
      if (!confirm(`${file} already exists in ${target.repo}. Overwrite it?`)) { ceSay('', ''); return }
      sha = (await cur.json()).sha
    }
    const body = { message: `Add script: ${meta.name}`, branch: target.branch, sha,
      content: btoa(String.fromCharCode(...new TextEncoder().encode(codeArea.value))) }
    const r = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) })
    if (!r.ok) throw new Error(r.status === 404 || r.status === 403 ? `${r.status}: token lacks write access to ${target.repo}` : `${r.status} ${r.statusText}`)
    const out = await r.json()
    const key = sourceKey(target)
    caches[key] ||= { files: {}, syncedAt: Date.now() }
    caches[key].files[file] = { sha: out.content.sha, code: codeArea.value }
    await kvSet('caches', caches)
    if (editing) { delete local.files[editing.file]; favs.delete('local/' + editing.file); await kvSet('local', local) }
    rebuild(); renderLocal(); sheet.hidden = true
    setStatus('success', `Published ${file} to ${target.repo}`)
  } catch (e) {
    ceSay('error', 'Publish failed: ' + e.message)
  } finally { $('cePublish').disabled = false }
}

// Import: fetch a .js file from a URL and open it in the editor for review before saving.
function toRawUrl(u) {
  const m = u.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/blob\/(.+)$/)
  return m ? `https://raw.githubusercontent.com/${m[1]}/${m[2]}` : u
}
$('importUrl').onclick = async () => {
  const u = $('importInput').value.trim()
  if (!/^https:\/\//.test(u)) return setStatus('error', 'Enter an https:// link to a .js file')
  const btn = $('importUrl'); btn.disabled = true
  try {
    const r = await fetch(toRawUrl(u))
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
    const code = await r.text()
    if (!parseMeta(code)) throw new Error('not a Boop script (no /** {json} **/ header)')
    $('importInput').value = ''
    openScriptEditor(null, code)
    ceSay('info', 'Review the code, then Save. Imported scripts run on your text.')
  } catch (e) { setStatus('error', 'Import failed: ' + e.message) }
  finally { btn.disabled = false }
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
  } else if (p.get('picker') === '1') q.focus()
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
  local = (await kvGet('local')) || { files: {} }
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
  renderResults()
  if (location.hash.length > 1) await handleHash()
  $('ver').textContent = (new URL(document.querySelector('script[src*="app.js"]').src).searchParams.get('v') || 'dev')
  if ('serviceWorker' in navigator) {
    let controlled = !!navigator.serviceWorker.controller   // false on the very first visit
    let reloaded = false
    // A new deploy took over: reload once so the page, styles and scripts all come from it.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (controlled && !reloaded) { reloaded = true; location.reload() }
      controlled = true   // the first install claiming this page is not an update
    })
    navigator.serviceWorker.register('sw.js').then(reg => {
      // Home-screen apps are often resumed rather than relaunched; check for updates on every resume.
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}) })
      reg.update().catch(() => {})
    }).catch(() => {})
  }
  if (navigator.onLine) sync(false)
}
boot()
