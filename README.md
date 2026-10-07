# Floop

**[Boop](https://github.com/IvanMathy/Boop) for iPhone.** A pocket-sized scratchpad that transforms text with small JavaScript scripts: format JSON, encode Base64, sort lines, hash, and about a hundred more. It's an offline-capable web app (PWA) that runs Boop's own scripts unchanged.

<p align="center">
  <img src="web/docs/screenshot.png" width="300" alt="Floop on an iPhone: formatted JSON in the editor, the script list and search in the footer">
</p>

**Open it: <https://wabiloo.github.io/floop/>**, then in Safari tap Share → **Add to Home Screen**.

- Pick a script from the always-visible list (fuzzy search, favourites), and it rewrites your selection or the whole text. Undo, copy and paste included.
- Works offline, and syncs scripts from this repo (or any GitHub folder you add).
- Write your own scripts in the app, import them from a link, or have Claude or ChatGPT write them. Publish them back to GitHub if you like.
- Run scripts from the iOS Shortcuts app and Share Sheet through deep links.

Everything about the app is in **[web/README.md](web/README.md)**. The app lives in [`web/`](web/) and is deployed by [`.github/workflows/pages.yml`](.github/workflows/pages.yml). Your own scripts go in [`Scripts/`](Scripts/).

Floop is a fork of [IvanMathy/Boop](https://github.com/IvanMathy/Boop), the macOS app, and is not affiliated with it. The scripts, the script format and the idea are Boop's (MIT licence, see [LICENSE](LICENSE)). The rest of this file is Boop's original README for the Mac app.

---


# Boop.


<p align="center">

  <img src="Boop/Documentation/Images/UI.png?raw=true" width="663" alt="UI Screenshot">
</p>


<p align="center">
  <a href="https://app.bitrise.io/app/b0c493f8b65e1dac"><img src="https://app.bitrise.io/app/b0c493f8b65e1dac/status.svg?token=BoJJDoViYpKy8V_O5P7ljA&branch=main"></a>
  <a href="https://sonarcloud.io/dashboard?id=IvanMathy_Boop"><img src="https://sonarcloud.io/api/project_badges/measure?project=IvanMathy_Boop&metric=alert_status"></a>
</p>   
<p align="center">
  <a href="https://boop.okat.best/">Website</a>  •  <a href="https://github.com/IvanMathy/Boop/releases">Download from GitHub</a>  •  <a href="https://apps.apple.com/us/app/boop/id1518425043">Get on the Mac App Store</a><br/>
    <a href="https://github.com/IvanMathy/Boop/blob/main/Boop/Documentation/Readme.md">Documentation</a>  •  <a href="https://github.com/IvanMathy/Boop/tree/main/Scripts">Find more scripts</a>
</p>

### How to get Boop

There are four ways to get Boop. Your best bet is either to

 - <a href="https://github.com/IvanMathy/Boop/releases">Download from GitHub releases</a> or
 - <a href="https://apps.apple.com/us/app/boop/id1518425043">Download on the Mac App Store</a><br/>.

 You can also build it from source, or <a href="https://formulae.brew.sh/cask/boop#default">get it from Homebrew</a>, although that is not officially supported.

### How to build from source

If you're just trying to get Boop, building from source might not be your best bet. Developing new scripts does not require building from source.

- Clone or download a copy of the repository
- Open `Boop/Boop.xcodeproj`
- Press play


### Documentation

- [Documentation](Boop/Documentation/Readme.md)
- [Custom scripts](Boop/Documentation/CustomScripts.md)
