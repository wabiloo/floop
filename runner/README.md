# floop-runner

Runs Boop/Floop scripts in Node, with no browser and no dependencies. It mirrors `web/worker.js` and `web/scripts.js` (header parsing, `@boop/…` modules, `ScriptExecution`), using a `vm` sandbox with a 15 s timeout.

```
node runner/cli.mjs list json
echo '{"a":1}' | node runner/cli.mjs run "Format JSON"
node runner/cli.mjs run base64encode hello
```
`-d <folder>` (or `FLOOP_SCRIPTS=a:b`) chooses script folders; the default is this repo's `Boop/Boop/scripts` and `Scripts`. `npm link` in this folder installs a `floop` command.

As a library: `import { loadScripts, findScript, runScript } from './index.mjs'` (types in `index.d.mts`). `npm test` runs the tests. The [Raycast extension](../raycast/README.md) uses this module.
