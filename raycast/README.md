# Floop for Raycast

Run [Floop](../README.md) / [Boop](https://github.com/IvanMathy/Boop) scripts from Raycast, **locally and offline**: scripts execute in Node through [`../runner`](../runner), with no browser involved.

## Commands
- **Run Floop Script**: pick a script from the list. It runs on the selected text (or the clipboard if nothing is selected).
  `↵` shows the result · `⌘↵` pastes over the selection · `⇧⌘↵` copies.
  `⌘K` sets aliases for the highlighted script (e.g. `b64`); they show as tags, work as search terms in the list, and are accepted by the by-name command. Aliases are stored in Raycast's local storage.
- **Run Floop Script by Name**: no UI. Takes the script name as an argument (fuzzy: `format json`, `b64enc`…), runs it and pastes (or copies) the result. Give it a hotkey, or make Quicklinks that pre-fill the argument (one per script you use often).

## Install (from a checkout)
```
git clone https://github.com/wabiloo/floop && cd floop/raycast
npm install && npm run dev      # Raycast loads it as a dev extension
```
Then in the extension's preferences set **Floop Checkout** to your clone (so it finds `Boop/Boop/scripts` and `Scripts`). Add your own scripts folders under **Extra Script Folders**. `npm run build` produces a build you can keep imported.

Raycast must have Accessibility access to read the selection and paste.

## Notes
- Scripts run in a `vm` sandbox with a 15 s timeout, with the same `ScriptExecution` API as Floop (`text`, `fullText`, `selection`, `insert`, `postInfo`, `postError`) and `require('@boop/…')`.
- Multi-cursor isn't supported (same as Floop): the whole text is passed as `fullText`.
- Untested inside Raycast itself (macOS only); the runner has tests (`cd ../runner && npm test`).
