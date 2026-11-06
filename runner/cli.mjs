#!/usr/bin/env node
// floop — run Boop/Floop scripts from the command line.
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readFileSync } from 'node:fs'
import { loadScripts, findScript, search, runScript } from './index.mjs'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const defaultDirs = [join(repo, 'Boop/Boop/scripts'), join(repo, 'Scripts')]

const HELP = `floop — run Boop/Floop scripts without a browser

Usage:
  floop list [query] [--json]       list scripts (optionally filtered)
  floop run <script> [text]         run a script; reads stdin when no text is given
  floop info <script>               show a script's metadata

Options:
  -d, --dir <folder>   scripts folder (repeatable; default: this repo's script folders)
  -q, --quiet          don't print script messages to stderr

Also: FLOOP_SCRIPTS=dir1:dir2 sets the folders.
Examples:
  echo '{"a":1}' | floop run "Format JSON"
  floop run base64encode hello
`

const args = process.argv.slice(2)
const dirs = [], rest = []
let json = false, quiet = false
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a === '-d' || a === '--dir') dirs.push(args[++i])
  else if (a === '--json') json = true
  else if (a === '-q' || a === '--quiet') quiet = true
  else if (a === '-h' || a === '--help') { console.log(HELP); process.exit(0) }
  else rest.push(a)
}
const [cmd, ...params] = rest
if (!cmd) { console.log(HELP); process.exit(cmd ? 0 : 1) }

const envDirs = (process.env.FLOOP_SCRIPTS || '').split(':').filter(Boolean)
const scripts = loadScripts(dirs.length ? dirs : envDirs.length ? envDirs : defaultDirs)

const pick = q => {
  const s = q && findScript(scripts, q)
  if (!s) { console.error(`No script matching "${q ?? ''}". Try: floop list`); process.exit(2) }
  return s
}

if (cmd === 'list') {
  const found = params[0] ? search(scripts, params.join(' ')) : scripts
  if (json) console.log(JSON.stringify(found.map(({ code, files, source, id, ...m }) => m), null, 2))
  else for (const s of found) console.log(`${s.name.padEnd(32)} ${s.description}`)
} else if (cmd === 'info') {
  const { code, files, id, ...m } = pick(params.join(' '))
  console.log(JSON.stringify(m, null, 2))
} else if (cmd === 'run') {
  const s = pick(params[0])
  const text = params.length > 1 ? params.slice(1).join(' ') : readFileSync(0, 'utf8')
  const r = runScript(s, { fullText: text })
  if (!quiet) for (const m of r.messages) console.error(`${m.type}: ${m.message}`)
  process.stdout.write(r.text)
  process.exit(r.failed ? 1 : 0)
} else {
  console.error(`Unknown command "${cmd}"\n\n${HELP}`)
  process.exit(1)
}
