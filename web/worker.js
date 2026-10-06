// Sandbox for a single Boop script. One worker per script, kept alive between
// runs so top-level globals persist, like Boop's per-script JSContext.
// Workers have no DOM/window, which is close to JavaScriptCore's headless context.

let modules = {}      // path (relative to scripts root) -> source, prefetched by the page
let moduleCache = {}
let scriptName = 'Unknown Script'
let mainFn = null
let messages = []

class ScriptExecution {
  constructor(selection, fullText, insertIndex) {
    this.isSelection = selection !== null && selection !== undefined
    this.selection = this.isSelection ? selection : null
    this.fullText = fullText
    this.insertIndex = insertIndex
    this.insertOffset = 0
  }
  get text() { return this.isSelection ? this.selection : this.fullText }
  set text(v) { if (this.isSelection) this.selection = v; else this.fullText = v }
  postError(m) { messages.push({ type: 'error', message: String(m) }) }
  postInfo(m) { messages.push({ type: 'info', message: String(m) }) }
  insert(v) {
    v = String(v)
    if (this.isSelection) { this.selection = v; return }
    if (this.insertIndex == null || this.fullText == null) { this.fullText = v; return }
    const at = this.insertIndex + this.insertOffset
    this.fullText = this.fullText.slice(0, at) + v + this.fullText.slice(at)
    this.insertOffset += v.length
  }
}
self.ScriptExecution = ScriptExecution

function resolve(path) {
  if (!path.endsWith('.js')) path += '.js'
  if (path.startsWith('@boop/')) path = 'lib/' + path.slice(6)
  return path.replace(/^\.\//, '')
}

function boopRequire(path) {
  const key = resolve(String(path))
  if (key in moduleCache) return moduleCache[key].exports
  const code = modules[key]
  if (code === undefined) throw new Error(`Cannot find module '${path}'`)
  const module = { exports: {} }
  moduleCache[key] = module
  new Function('exports', 'module', 'require', code).call(module.exports, module.exports, module, boopRequire)
  return module.exports
}
self.require = boopRequire

function fail(e) {
  return `[${scriptName}] Error: ${e && e.message ? e.message : e}`
}

self.onmessage = ({ data }) => {
  if (data.type === 'load') {
    modules = data.modules
    scriptName = data.name
    try {
      // Indirect eval: `function main` lands on the global object, top-level
      // const/let stay visible to it through closure.
      ;(0, eval)(data.code + '\n;self.__boopMain = (typeof main === "function") ? main : undefined')
      mainFn = self.__boopMain
      if (!mainFn) throw new Error('script does not define main()')
      postMessage({ type: 'loaded' })
    } catch (e) {
      postMessage({ type: 'loaded', error: fail(e) })
    }
    return
  }
  if (data.type === 'run') {
    messages = []
    const exec = new ScriptExecution(data.selection, data.fullText, data.insertIndex)
    let error = null
    try { mainFn(exec) } catch (e) { error = fail(e) }
    if (error) messages.push({ type: 'error', message: error })
    postMessage({
      type: 'result',
      runId: data.runId,
      text: exec.text,
      isSelection: exec.isSelection,
      insertOffset: exec.insertOffset,
      messages,
    })
  }
}
