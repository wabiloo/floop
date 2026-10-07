# Floop (web)

[Boop](https://github.com/IvanMathy/Boop) on any device, as an offline-capable PWA for phones, tablets and desktops. It runs unmodified Boop scripts
(`main(state)`, `state.text / fullText / selection / isSelection`, `insert()`, `postInfo()`, `postError()`,
`require('@boop/…')`, `bias`, tags, fuzzy search) in a per-script Web Worker.

## Install
Open <https://wabiloo.github.io/floop/> in any modern browser; it works there as is. To install it as an app:
- **iPhone / iPad:** Safari → Share → **Add to Home Screen**.
- **Android:** Chrome → menu → **Install app** (or *Add to Home screen*).
- **Desktop:** Chrome or Edge → the install icon in the address bar. On wide screens the layout switches to two columns.

It was designed and tested phone-first on iOS; other platforms use the same code but get less testing.

Updates arrive by themselves: each deploy gets its own offline cache, and the app checks for a new version whenever you bring it to the front, then reloads once. *Settings → About* shows the version.

To host your own copy: fork the repo, then **Settings → Pages → Source: GitHub Actions** and run the *Deploy Floop (web)* workflow (or push to `main`). Change `DEFAULT_SOURCES` in `web/scripts.js` to point at your fork.

## Using it
- **Run a script:** tap it in the list, or type in the search box and press Enter to run the best match. An empty search shows recents, then everything A–Z. Queries of 20+ characters return nothing, as in Boop.
- **What it changes:** a selection is transformed in place; with no selection the whole text is (or `insert()` goes at the caret).
- **Favourites:** tap a star to favourite a script (the order doesn't change). The star button beside the search box shows only favourites.
- **Messages** from scripts, sync and clear open as a row above the script list for a few seconds.
- **Your text** is kept on the device between launches.
- **Layout:** on wide screens (about 860px and up) the editor is on the left and the script list on the right; settings rise from the bottom of the editor column. Phones keep one column.

### Toolbar
| Icon | Does |
|---|---|
| Eraser | Clear the text (undoable) |
| Floppy disk | Save the text under a name |
| Folder | Open a saved or auto-saved text |
| Download arrow | Fetch a URL into the editor |
| Paste / Copy | Replace the selection (or everything) / copy the selection (or everything) |
| Repeat | Run the last script again |
| Undo / Redo | Step through the text history |
| Gear | Settings |

### Fetch a URL
- The download button sends an HTTP GET and replaces the text with the response.
- If a URL is selected, under the caret, or is the whole text, it is fetched straight away. Otherwise a dialog asks for one.
- Shift-click the button to open the dialog even when the text has a URL, for example to edit the optional request headers (`Name: value`, one per line, kept on this device).
- The server must allow cross-origin requests (CORS), which the browser enforces; custom headers also need to be allowed by the server.

### Saved texts
- **Save** keeps the whole text under a name (the dialog suggests the first line). Saving under an existing name replaces it.
- **Open** lists saved texts with a filter and Rename / Delete. Tapping one replaces the editor text, and Undo brings the old text back.
- Saved texts also show up in the script search box (document icon), matched by name or content.
- **Auto-saved:** the last 20 texts that were cleared, fetched over, opened over or pasted over are kept automatically, listed under Open.
- Everything is stored in this browser only; it doesn't sync between devices.

### Keyboard shortcuts
Listed in Settings → *Keyboard shortcuts* and in the button tooltips (⌘ on a Mac, Ctrl elsewhere):
`Ctrl+K` search scripts · `Ctrl+Enter` run the last script again · `Ctrl+Z` undo · `Ctrl+Shift+Z` (or `Ctrl+Y`) redo · `Ctrl+Shift+X` clear · `Ctrl+S` save · `Ctrl+O` open · `Ctrl+Shift+U` fetch a URL.

## Script sources
Settings → *Script sources* lists GitHub folders (`owner/repo@branch` + folder).
- **Defaults:** `Boop/Boop/scripts` and `Scripts` in `wabiloo/floop`.
- **What counts as a script:** top-level `.js` files with a `/** {json} **/` header. Subfolders such as `lib/` hold modules for `require()`, and `@boop/x` resolves to `lib/x.js` from any source.
- **Private repos:** add a token in Settings.
- **Sync** runs at launch (when online) and on demand. Scripts are cached in IndexedDB.
- **Offline first launch:** the site ships a snapshot (`scripts-bundle.json`, built from this repo at deploy time).

## Your own scripts
Settings → *My scripts*.
- **Write one:** **+ New script** opens an editor with a starter template. **Test** runs it on your current text without changing it. **Save** keeps it on this device (listed as "On this device").
- **Import:** fetches a raw `.js` URL or a github.com file page and opens it for review before saving.
- **Have an AI write it**, either:
  - *With an API key* (Settings → *AI providers*, Anthropic and/or OpenAI): describe the script and tap *Write with Claude* or *Write with ChatGPT*. The call goes straight from your device to the provider. Keys stay on-device and the models are editable (defaults `claude-sonnet-5-5`, `gpt-4o`).
  - *Without a key:* describe the script, tap *Copy prompt* (it includes Boop's script format and API), paste it into any chat AI, copy the reply, then tap *Paste reply*. Code fences are stripped and the header is validated.
  - Either way, then Test and Save.
- **Publish to GitHub** (needs a token with write access to contents) commits the script to the chosen source, by default the last one (`Scripts/`). It then syncs to your other devices and the on-device copy is removed.
- **Trust:** imported and local scripts run with the same powers as any other script, so only import code you trust.
- **Icons:** a script's `"icon"` names one of Boop's Icons8 icons (for example `broom`, `link`, `table`). Anything else, such as macOS-only SF Symbol names, shows a question mark.

## Shortcuts / deep links
Deep links work on every platform; the recipe below is for the iOS Shortcuts app.

`https://<user>.github.io/floop/#script=Base64%20Encode&text=hello&copy=1`

| param | meaning |
|---|---|
| `text` / `b64` | input text (URL-encoded / base64url UTF-8) |
| `script` | script name or file name |
| `copy=1` | copy the result to the clipboard |
| `callback` | URL to open afterwards; `{result}` is replaced by the URL-encoded result |
| `picker=1` | focus the search box |

**Share Sheet recipe** (Shortcuts app): *Receive Text from Share Sheet* → *URL Encode* → *Open URLs*
`https://<user>.github.io/floop/#script=Base64%20Encode&copy=1&text=` + encoded text.
To get the result back into Shortcuts, add `&callback=shortcuts://run-shortcut?name=Handle%20Result%26input=text%26text={result}`
(note `{result}` is already encoded; the `&` inside the callback must be `%26`) and build a second shortcut named *Handle Result*.
iOS opens such links in Safari rather than the home-screen app, and clipboard writes can need a tap. If `copy=1` is blocked, tap **Copy**. (This recipe is untested on a device.)

## Differences from Boop
- No multi-cursor (a text field has one selection), so scripts run once per run.
- Script icons use Boop's Icons8 set; SF Symbol names (macOS only) fall back to a question mark.
- Scripts run in Web Workers (15 s timeout) rather than JavaScriptCore; they have `self`, `fetch`, etc. that JSC lacks.
- `require` is resolved statically (string-literal paths), because workers can't load modules synchronously.

## Development
```
node web/build.mjs . _site && npx http-server _site
```
`build.mjs` copies `web/` to `_site/`, snapshots the default script folders into `scripts-bundle.json`, and stamps the service worker and asset URLs with a content hash. There are no dependencies and no bundler. To pull in upstream Boop changes: `git remote add upstream https://github.com/IvanMathy/Boop && git fetch upstream && git merge upstream/main`.

## Privacy
There is no server and no analytics. Your text never leaves the device, except that scripts you run can do whatever their code does. API keys and the GitHub token are stored in the browser on your phone and sent only to GitHub, Anthropic or OpenAI respectively.

## Credits
Boop by [Ivan Mathy](https://github.com/IvanMathy/Boop) (MIT). Icons: [Font Awesome Free](https://fontawesome.com) (CC BY 4.0), inlined as an SVG sprite; script icons from [Icons8](https://icons8.com), as used by Boop. Fuzzy search: [Fuse.js](https://www.fusejs.io) (Apache 2.0).
