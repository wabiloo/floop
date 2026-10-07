
# Additional scripts

This folder contains useful scripts not included in the default Boop library you might want to download. 

## Installing new scripts

To install a new script, simply download the .js file and place it into the same folder as your custom scripts. If Boop is already open, reload scripts from the `Scripts` menu.

## Contributing

Made something useful? Think of a way to improve an existing script? Feel free to open a pull request or a new issue on GitHub!
## Scripts with dependencies

- `parseUrl.js` and `urlToFormattedString.js` need `lib/url.js`: copy the `lib` folder next to them in your scripts folder.
- `decodeScte35.js` is a bundled build; its sources and build steps are in `scte35-build/` (not needed to use the script).
