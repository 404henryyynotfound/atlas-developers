# atlas-developers-gui

Launcher for the [Atlas Developers](https://github.com/404henryyynotfound/atlas-developers) desktop app.

```bash
npm install -g atlas-developers-gui
atlas-gui
```

The launcher detects your OS and architecture, downloads the matching GUI
artifact from the latest GitHub release, verifies its `.sha256` checksum, caches
it under `~/.atlas-developers/gui/`, and starts the app.

Preview the download plan without installing anything:

```bash
atlas-gui --dry-run
```

Install the npm CLI too:

```bash
npm install -g atlas-developers-cli atlas-developers-gui
```
