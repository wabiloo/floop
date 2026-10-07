# Floop (web)

[Boop](https://github.com/IvanMathy/Boop) for iPhone, as an offline-capable PWA. It runs unmodified Boop scripts
(`main(state)`, `state.text / fullText / selection / isSelection`, `insert()`, `postInfo()`, `postError()`,
`require('@boop/…')`, `bias`, tags, fuzzy search) in a per-script Web Worker.

## Install on iPhone
Open <https://wabiloo.github.io/floop/> in Safari → Share → **Add to Home Screen**.

Updates arrive by themselves: each deploy gets its own offline cache, and the app checks for a new version whenever you bring it to the front, then reloads once. *Settings → About* shows the version.

To host your own copy: fork the repo, then **Settings → Pages → Source: GitHub Actions** and run the *Deploy Floop (web)* workflow (or push to `main`). Change `DEFAULT_SOURCES` in `web/scripts.js` to point at your fork.

## Using it
- The footer is always the script list: tap a script to run it, or type in the search box to filter (Enter runs the best match). Empty search shows recents, then everything A–Z.
- A selection is transformed in place; with no selection the whole text is (or `insert()` goes at the caret).
- Tap a star to favourite a script (it doesn't change the order); the star button next to the search box shows only favourites.
- Header icons: clear (undoable), paste (replaces the selection, or everything), copy (selection, or everything), repeat last script, undo, redo, settings. Messages from scripts appear in the line underneath.
- Your text is kept on the device between launches.
- Like Boop, search queries of 20+ characters return nothing.

## Script sources
Settings → *Script sources* lists GitHub folders (`owner/repo@branch` + folder). Defaults: `Boop/Boop/scripts` and `Scripts` in `wabiloo/floop`.
Top-level `.js` files with a `/** {json} **/` header are scripts; subfolders (`lib/`) are modules for `require()`.
`@boop/x` resolves to `lib/x.js` from any source. Add a token in settings for private repos.
Sync runs at launch (when online) and on demand; scripts are cached in IndexedDB. The site also ships a snapshot
(`scripts-bundle.json`, built from this repo at deploy time) so first launch works offline.

## Your own scripts
Settings → *My scripts*: **+ New script** opens an editor with a starter template. **Test** runs it on your current editor text without changing it; **Save** keeps it on this device (shown as "On this device" in the list). **Import** fetches a raw `.js` URL or a github.com file page and opens it for review before saving.
**Ask an AI to write it:** with an Anthropic (Claude) and/or OpenAI (ChatGPT) API key entered under Settings → *AI providers*, the editor shows *Write with Claude* / *Write with ChatGPT* buttons that call the provider directly from your phone (keys stay on-device; models are editable, defaults `claude-sonnet-5-5` and `gpt-4o`). Without a key, or if you prefer a chat app: describe the script in the editor, tap *Copy prompt* (it includes Boop's script format and API), paste it into any chat AI, copy its reply, and tap *Paste reply*; code fences are stripped and the header is validated. Then Test and Save.
With a GitHub token set, **Publish to GitHub** commits the script to the chosen source (default: the last one, `Scripts/`), after which it syncs to your other devices and the on-device copy is removed. The token needs write access (contents) to that repo.
Imported and local scripts run with the same powers as any other script, so only import code you trust.

## Shortcuts / deep links
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
- Script icons are not rendered (initial letter badge instead).
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
Boop by [Ivan Mathy](https://github.com/IvanMathy/Boop) (MIT). Icons: [Font Awesome Free](https://fontawesome.com) (CC BY 4.0), inlined as an SVG sprite. Fuzzy search: [Fuse.js](https://www.fusejs.io) (Apache 2.0).
