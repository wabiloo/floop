import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { loadScripts, findScript, search, runScript, parseMeta } from './index.mjs'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const scripts = loadScripts([join(repo, 'Boop/Boop/scripts'), join(repo, 'Scripts')])
const run = (q, text) => runScript(findScript(scripts, q), { fullText: text })

test('discovers scripts and skips lib/ modules', () => {
  assert.ok(scripts.length > 90)
  assert.ok(scripts.every(s => !s.file.includes('/')))
})
test('parseMeta reads the header', () => {
  assert.equal(parseMeta('/** {"name":"x"} **/ function main(){}').name, 'x')
  assert.equal(parseMeta('no header'), null)
})
test('findScript: by name, file name and fuzzy', () => {
  assert.equal(findScript(scripts, 'Base64 Encode').file, 'Base64Encode.js')
  assert.equal(findScript(scripts, 'base64encode').file, 'Base64Encode.js')
  assert.equal(findScript(scripts, 'b64 enc').file, 'Base64Encode.js')
  assert.ok(search(scripts, 'json').length > 3)
})
test('plain scripts and @boop modules (cross-source lib)', () => {
  assert.equal(run('Base64 Encode', 'hello').text, 'aGVsbG8=')
  assert.equal(run('Upcase', 'abc').text, 'ABC')
  assert.equal(run('CSV to JSON (headerless)', 'a,b\n1,2').failed, undefined)
})
test('errors are reported, not thrown', () => {
  const r = run('Format JSON', 'not json')
  assert.equal(r.failed, true)
  assert.match(r.messages[0].message, /Invalid JSON/)
})
test('selection mode only rewrites the selection', () => {
  const r = runScript(findScript(scripts, 'Upcase'), { selection: 'abc', fullText: 'xx abc' })
  assert.equal(r.text, 'ABC')
  assert.equal(r.isSelection, true)
})
test('infinite loops time out', () => {
  const s = { id: 't', file: 't.js', name: 'Loop', files: {}, sharedLibs: {}, code: 'function main(){ while(true){} }' }
  const r = runScript(s, { fullText: '', timeout: 200 })
  assert.equal(r.failed, true)
  assert.match(r.messages[0].message, /Timed out/)
})
