# Floop (web)

[Boop](https://github.com/IvanMathy/Boop) for iPhone, as an offline-capable PWA. It runs unmodified Boop scripts
(`main(state)`, `state.text / fullText / selection / isSelection`, `insert()`, `postInfo()`, `postError()`,
`require('@boop/…')`, `bias`, tags, fuzzy search) in a per-script Web Worker.

## Install on iPhone
1. Enable GitHub Pages: repo **Settings → Pages → Source: GitHub Actions**, then run the *Deploy Floop* workflow (or push to `main`).
2. Open `https://<user>.github.io/floop/` in Safari → Share → **Add to Home Screen**.

## Using it
- **Scripts** opens a bottom-sheet fuzzy picker (Enter / tap runs). Empty search shows recents, then everything A–Z.
- A selection is transformed in place; with no selection the whole text is (or `insert()` goes at the caret).
- **Again** re-runs the last script. **↶ ↷** step through the undo history. **Paste** replaces the selection (or everything); **Copy** copies the selection (or everything).
- Like Boop, search queries of 20+ characters return nothing.

## Script sources
Settings → *Script sources* lists GitHub folders (`owner/repo@branch` + folder). Defaults: `Boop/Boop/scripts` and `Scripts` in `wabiloo/floop`.
Top-level `.js` files with a `/** {json} **/` header are scripts; subfolders (`lib/`) are modules for `require()`.
`@boop/x` resolves to `lib/x.js` from any source. Add a token in settings for private repos.
Sync runs at launch (when online) and on demand; scripts are cached in IndexedDB. The site also ships a snapshot
(`scripts-bundle.json`, built from this repo at deploy time) so first launch works offline.

## Shortcuts / deep links
`https://<user>.github.io/floop/#script=Base64%20Encode&text=hello&copy=1`

| param | meaning |
|---|---|
| `text` / `b64` | input text (URL-encoded / base64url UTF-8) |
| `script` | script name or file name |
| `copy=1` | copy the result to the clipboard |
| `callback` | URL to open afterwards; `{result}` is replaced by the URL-encoded result |
| `picker=1` | open the script picker |

**Share Sheet recipe** (Shortcuts app): *Receive Text from Share Sheet* → *URL Encode* → *Open URLs*
`https://<user>.github.io/floop/#script=Base64%20Encode&copy=1&text=` + encoded text.
To get the result back into Shortcuts, add `&callback=shortcuts://run-shortcut?name=Handle%20Result%26input=text%26text={result}`
(note `{result}` is already encoded; the `&` inside the callback must be `%26`) and build a second shortcut named *Handle Result*.
iOS opens such links in Safari rather than the home-screen app, and clipboard writes can need a tap. If `copy=1` is blocked, tap **Copy**.

## Differences from Boop
- No multi-cursor (a text field has one selection), so scripts run once per run.
- Script icons are not rendered (initial letter badge instead).
- Scripts run in Web Workers (15 s timeout) rather than JavaScriptCore; they have `self`, `fetch`, etc. that JSC lacks.
- `require` is resolved statically (string-literal paths), because workers can't load modules synchronously.

## Development
```
node web/build.mjs . _site && npx http-server _site
```
