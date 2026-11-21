# Atlas Developers

**Tools for the work behind the money.**

A local-first developer-tools product from **Atlas Financial**. Track payments,
invoices, clients, projects, recurring costs, payouts, billable time and goals —
in the terminal, in a desktop app, or in a static web dashboard.

- No accounts, no OAuth, no Google sign-in.
- No payment processor APIs and no bank APIs. Every record is manual.
- One normalized JSON data model shared by CLI, GUI and dashboard.
- Zero runtime dependencies in the CLI and web app.
- Atlas AI works offline by default; an external LLM is strictly opt-in.
- **Atlas Suite** bundles every Atlas app into one desktop GUI (Snap + Flatpak).

## What's in this repository

| Path | Purpose |
| --- | --- |
| `core/` | Shared data model, atomic JSON store, deterministic insights and AI engine |
| `cli/` | Zero-dependency `atlas` command line tool |
| `gui/` | Electron shell that loads the web app and shares `~/.atlas-developers/data.json` |
| `atlas-suite/` | One GUI bundling Meridian, Airo, Tandem, Business, Calendar and Developers |
| `web/` | Static no-bundler SPA, deployed to `atlas-developers.surge.sh` |
| `install.sh` | Curl-installable CLI installer (Linux/macOS, x64/arm64) |
| `snapcraft.yaml`, `snap/` | Strict Snap packaging for Ubuntu App Center (CLI + GUI) |
| `.github/workflows/` | CI validation, tagged release builds and Snap builds for amd64/arm64 |

## Install the CLI

### One command (macOS / Linux)

```bash
curl -fsSL https://raw.githubusercontent.com/404henryyynotfound/atlas-developers/main/install.sh | bash
```

The installer detects your OS and architecture, downloads
`atlas-cli-<os>-<arch>.tar.gz` and its `.sha256` file from the latest GitHub
release, verifies the checksum, installs the CLI under `~/.local/share/atlas-developers/`
and symlinks `atlas` into `~/.local/bin`.

Pin a version:

```bash
ATLAS_VERSION=1.0.0 bash -c 'curl -fsSL https://raw.githubusercontent.com/404henryyynotfound/atlas-developers/main/install.sh | bash'
```

Custom locations:

```bash
ATLAS_INSTALL_DIR=/usr/local/bin ATLAS_SHARE_DIR=/usr/local/share/atlas-developers bash -c 'curl -fsSL https://raw.githubusercontent.com/404henryyynotfound/atlas-developers/main/install.sh | bash'
```

If `~/.local/bin` is not on your PATH, add it:

```bash
# bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# zsh
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Manual install

1. Download the correct archive and `.sha256` from the table below.
2. Verify it:

   ```bash
   sha256sum -c atlas-cli-linux-x64.tar.gz.sha256      # Linux
   shasum -a 256 -c atlas-cli-macos-arm64.tar.gz.sha256 # macOS
   ```

3. Extract and run:

   ```bash
   mkdir atlas-cli-linux-x64
   tar -xzf atlas-cli-linux-x64.tar.gz -C atlas-cli-linux-x64
   cd atlas-cli-linux-x64/cli
   ./bin/atlas.js --version
   ```

4. Put `bin/atlas.js` on your PATH (symlink it as `atlas`), or run with Node:

   ```bash
   node /path/to/atlas-cli-linux-x64/cli/bin/atlas.js init
   ```

Requires **Node.js 20 or newer**. On Windows, use the Windows CLI archive and
`atlas.cmd` (or `node bin/atlas.js`).

### npm package

```bash
npm install -g atlas-developers-cli
atlas --version
```

`atlas-developers-cli` pulls in `atlas-developers-core` automatically and gives
you the `atlas` command. No build tools or native modules are involved.

| npm package | Purpose | Command |
| --- | --- | --- |
| `atlas-developers-core` | Shared model, atomic JSON store, insights and local AI engine | library (auto dependency) |
| `atlas-developers-cli` | Zero-dependency terminal tool | `atlas` |
| `atlas-developers-gui` | Downloads, verifies, caches and launches the desktop GUI | `atlas-gui` |

All three are currently published at **1.0.4**. Tagged releases publish them
automatically using the repository's `NPM_TOKEN` secret.

### sudo system packages

Tagged releases also publish native installers for the CLI. These are JS-only
packages that install the `atlas` command system-wide.

**Linux (DEB, amd64 or arm64):**

```bash
VERSION=1.0.4
ARCH=amd64 # or arm64
BASE=https://github.com/404henryyynotfound/atlas-developers/releases/download/v${VERSION}
curl -fsSLO "${BASE}/atlas-developers-cli_${VERSION}_${ARCH}.deb"
curl -fsSLO "${BASE}/atlas-developers-cli_${VERSION}_${ARCH}.deb.sha256"
sha256sum -c "atlas-developers-cli_${VERSION}_${ARCH}.deb.sha256"
sudo apt install "./atlas-developers-cli_${VERSION}_${ARCH}.deb"
atlas --version
```

**macOS (PKG, works on Intel and Apple Silicon):**

```bash
VERSION=1.0.4
BASE=https://github.com/404henryyynotfound/atlas-developers/releases/download/v${VERSION}
curl -fsSLO "${BASE}/atlas-developers-cli-${VERSION}.pkg"
sudo installer -pkg "atlas-developers-cli-${VERSION}.pkg" -target /
atlas --version
```

The GUI also gets sudo-friendly installers in each release:
`atlas-gui-linux-<arch>.deb` for Linux and `atlas-gui-macos-<arch>.pkg` for
macOS. Windows users can use the NSIS installer (right-click → Run as
administrator) or the ZIP archive.

### Ubuntu / App Center (Snap)

A strict snap bundles the CLI, its Node runtime and the Electron GUI, with data
stored under the snap's own `SNAP_USER_COMMON/.atlas-developers` directory.

```bash
# From the Snap Store / Ubuntu App Center, once published:
sudo snap install atlas-developers

# Or sideload the signed-by-release asset from GitHub:
ARCH=arm64 # or amd64
VERSION=1.0.4
curl -fsSLO "https://github.com/404henryyynotfound/atlas-developers/releases/download/v${VERSION}/atlas-developers_${VERSION}_${ARCH}.snap"
sudo snap install --dangerous "./atlas-developers_${VERSION}_${ARCH}.snap"
atlas --version
```

The snap is built natively for `amd64` and `arm64` on tagged releases.
Publishing to the Snap Store uses the `SNAPCRAFT_STORE_CREDENTIALS` repository
secret; without it the build still uploads the `.snap` to the GitHub Release.

## Atlas Suite — every app in one GUI

`atlas-suite/` packages all six Atlas apps (Meridian, Airo, Tandem, Atlas
Business, Atlas Calendar and Atlas Developers) into one offline-capable Electron
window. The sidebar switches between locally bundled copies; one Atlas Sync
sign-in shares the resulting tokens with every app. No passwords are stored.

Ubuntu / App Center:

```bash
sudo snap install atlas-suite
```

Flatpak bundle (before Flathub submission):

```bash
flatpak install --user atlas-suite.flatpak
flatpak run com.atlasfinancial.Suite
```

Build artifacts are attached to the `atlas-suite-v*` GitHub Releases. The
`Build Atlas Suite` workflow bundles the public monorepo's apps, builds native
Linux/macOS/Windows installers, publishes the snap when
`SNAPCRAFT_STORE_CREDENTIALS` is available, and produces a single-file Flatpak
bundle for Flathub submission.

## Download the GUI

All links point to the public GitHub Releases "latest" assets. Each GUI build
has a matching `.sha256` file (append `.sha256` to the asset URL).

| Platform | Architecture | GUI | CLI |
| --- | --- | --- | --- |
| Linux | x64 | [AppImage](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-gui-linux-x64.AppImage) · [DEB](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-gui-linux-x64.deb) · [tar.gz](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-gui-linux-x64.tar.gz) | [atlas-cli-linux-x64.tar.gz](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-cli-linux-x64.tar.gz) |
| Linux | arm64 | [AppImage](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-gui-linux-arm64.AppImage) · [DEB](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-gui-linux-arm64.deb) · [tar.gz](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-gui-linux-arm64.tar.gz) | [atlas-cli-linux-arm64.tar.gz](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-cli-linux-arm64.tar.gz) |
| macOS | x64 (Intel) | [DMG](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-gui-macos-x64.dmg) · [PKG](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-gui-macos-x64.pkg) · [ZIP](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-gui-macos-x64.zip) | [atlas-cli-macos-x64.tar.gz](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-cli-macos-x64.tar.gz) |
| macOS | arm64 (Apple Silicon) | [DMG](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-gui-macos-arm64.dmg) · [PKG](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-gui-macos-arm64.pkg) · [ZIP](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-gui-macos-arm64.zip) | [atlas-cli-macos-arm64.tar.gz](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-cli-macos-arm64.tar.gz) |
| Windows | x64 | [EXE](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-gui-windows-x64.exe) · [ZIP](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-gui-windows-x64.zip) | [atlas-cli-windows-x64.tar.gz](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-cli-windows-x64.tar.gz) |
| Windows | arm64 | [EXE](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-gui-windows-arm64.exe) · [ZIP](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-gui-windows-arm64.zip) | [atlas-cli-windows-arm64.tar.gz](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-cli-windows-arm64.tar.gz) |

Prefer npm for the desktop app? The GUI launcher downloads and verifies the
correct release artifact for you:

```bash
npm install -g atlas-developers-gui
atlas-gui               # download, verify, cache and launch
atlas-gui --dry-run     # show the planned artifact without launching
```

The dashboard also has a built-in [downloads page](https://atlas-developers.surge.sh/#/downloads)
that detects your OS/architecture and highlights the right assets.

## First run

```bash
atlas init
atlas status
atlas ai insight
```

Example workflow:

```bash
atlas clients add "Northstar Studio" --email billing@northstar.test --rate 120
atlas projects add "Website refresh" "Northstar Studio" --rate 135
atlas payments add --type income --amount 1200 --description "Retainer" --client "Northstar Studio"
atlas payments add --type expense --amount 19 --description "Hosting" --category software
atlas invoices add --client "Northstar Studio" --amount 500 --days 14
atlas invoices paid INV-2026-001
atlas time add "Website refresh" 2.5 "Discovery workshop"
atlas subscriptions add "Design suite" --amount 24 --frequency monthly
atlas report
atlas ai ask "what is my monthly burn?"
```

### CLI command reference

| Command | Description |
| --- | --- |
| `atlas --version` / `--help` | Version and help |
| `atlas init` | Create local config and data files |
| `atlas status` | Data summary and cloud/local mode |
| `atlas payments list\|add\|paid` | Income and expenses, with filters and running totals |
| `atlas invoices list\|add\|send\|paid` | Invoice lifecycle |
| `atlas clients list\|add` | Client records |
| `atlas projects list\|add` | Projects and rates |
| `atlas subscriptions list\|add` | Recurring costs and annualized total |
| `atlas payouts list\|add\|paid` | Outgoing payouts |
| `atlas time list\|add` | Billable time |
| `atlas goals list\|add` | Targets and progress |
| `atlas report` | Cashflow summary and six-month table |
| `atlas export [--json]` | Write an export file, or print JSON to stdout |
| `atlas import <file>` | Replace local data from a JSON export |
| `atlas ai insight` | Deterministic local analysis |
| `atlas ai ask "<question>"` | Local intent parser, optional external LLM |
| `atlas config get\|set <key> <value>` | Local configuration |

Colors are used only on a TTY; set `NO_COLOR=1` to disable them.

## Atlas AI

The default engine is **local and deterministic**. It reads your payment history
and computes:

- total received, spent and net cashflow
- top clients by paid income
- average monthly burn and subscription annualization
- overdue invoice count and value
- upcoming subscription, payout and invoice dates
- suggested next actions

Nothing leaves your machine. `atlas ai ask "..."` matches intents such as
clients, burn, overdue, invoices, subscriptions, cashflow, time, goals, payouts,
income and expenses, with a `help` fallback.

Optional external LLM (no keys are hardcoded or committed):

```bash
export ATLAS_AI_ENDPOINT="https://your-llm.example/v1/chat"
export ATLAS_AI_KEY="your-own-secret"
atlas ai ask "summarize my cashflow"
```

The same fields can be stored locally with `atlas config set aiEndpoint ...` and
`atlas config set aiKey ...`, or entered in the dashboard's Settings screen.
The UI clearly labels **Local deterministic engine** vs **External LLM**, and
falls back to local answers if the endpoint fails. Only a compact numeric
context (totals, top clients, upcoming dates, recent payment descriptions) is
sent — never your whole dataset and never your keys in logs.

## Web dashboard

- Live at <https://atlas-developers.surge.sh>
- Static ES-module SPA: no bundler, no framework, no runtime dependencies.
- Routes: overview, payments, invoices, clients, projects, subscriptions, time,
  payouts, goals, insights, downloads and settings.
- A bottom-right Calendar widget reads derived dates from Atlas Sync, refreshes
  over `calendar` SSE frames, and links to Atlas Calendar.
- Dependency-free inline SVG charts.
- All user-controlled text is HTML-escaped; empty states are explicit.

In a browser the dashboard stores data in `localStorage`. In the Electron GUI,
a minimal preload bridge redirects the same store to
`~/.atlas-developers/data.json`, so the desktop app and CLI read and write the
same file.

Optional cloud sync uses an `atlas-sync` app slug `developer`:

```
https://your-atlas-sync.example/developer?token=<your-token>
```

It uses `EventSource` for inbound updates and `POST` for outbound changes. It is
off by default; if unavailable, the app continues in local-only mode. No OAuth.

## Data, privacy and backups

- CLI/GUI data: `~/.atlas-developers/data.json`
- CLI config: `~/.atlas-developers/config.json`
- Override the location with `ATLAS_HOME=/some/path`.
- Writes are atomic (temp file + rename).
- Export with `atlas export --json > backup.json` or Settings → Export JSON.
- Import with `atlas import backup.json`.
- Clear with `atlas config`-free Settings → Clear data, or delete the ATLAS_HOME
  directory.

No analytics, telemetry, third-party scripts, or embedded credentials.

## Development

```bash
# Validate everything locally
bash -n install.sh
node cli/test.js
find . -type d -name node_modules -prune -o -name '*.js' -type f -print0 | xargs -0 -n1 node --check

# Run the CLI from source
node cli/bin/atlas.js --help

# Serve the static dashboard (http://localhost:4173)
npm run web:dev

# Run the Electron shell against the source web app
npm install --prefix gui
npm --prefix gui run start

# Deploy the dashboard (requires surge credentials in your environment)
npm run web:deploy     # -> atlas-developers.surge.sh
```

`gui/main.js` serves `web/` from a loopback HTTP server inside the app because
Chromium blocks ES-module imports on `file://`. Release packaging copies `web/`
to `gui/web-build/` first.

## Release process

1. Update the version in the root `package.json`, `cli/package.json`,
   `gui/package.json`, `web/package.json` and `core/package.json`. The CLI
   derives its reported version from `core/package.json`, so `core/src/version.js`
   needs no manual edit.
2. Commit and push to `main`; CI runs JavaScript syntax checks, `bash -n` on the
   installer, and `node cli/test.js`.
3. Tag and push:

   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

4. `.github/workflows/release.yml` builds six CLI archives plus SHA-256 files,
   six GUI builds plus SHA-256 files, the Linux `.deb` and macOS `.pkg` sudo
   installers, and publishes them to the GitHub Release for that tag.
5. `.github/workflows/publish-npm.yml` publishes `atlas-developers-core`,
   `atlas-developers-cli` and `atlas-developers-gui` to npm using `NPM_TOKEN`.
6. `.github/workflows/snap.yml` builds native `amd64` and `arm64` snaps, uploads
   them to the GitHub Release and publishes to the Snap Store when
   `SNAPCRAFT_STORE_CREDENTIALS` is configured.
7. Tag `suite-v1.0.0` (or run the workflow manually) to build Atlas Suite.
   `.github/workflows/atlas-suite.yml` bundles the public monorepo, builds all
   six desktop targets, publishes `atlas-suite` to the Snap Store, and attaches
   a single-file Flatpak bundle for Flathub.
8. Deploy the static site separately with `npm run web:deploy`.

### Build caveats

- GUI builds are **unsigned**: no Apple Developer or Windows code-signing
  certificate is configured. macOS users may need right-click → Open; Windows
  SmartScreen may warn. CI sets `CSC_IDENTITY_AUTO_DISCOVERY=false` explicitly.
- The release workflow normalizes electron-builder labels to
  `atlas-gui-${os}-${arch}.${ext}` (`x86_64`/`amd64` become `x64`, `win` becomes
  `windows`, and macOS `.pkg` files are built separately). The download page
  links above are the canonical names to keep in sync.
- Linux arm64 GUI cross-builds from `ubuntu-latest` may require the
  `gcc-aarch64-linux-gnu` toolchain for native modules. The workflow installs it.
 macOS signing/notarization is not performed.
- The CLI is plain Node JavaScript, so the same archive works across CPU
  architectures once Node 20+ is available; separate archives are still built
  for all six targets to keep installer detection simple.

## License

MIT © Atlas Financial. See [LICENSE](LICENSE) and [SECURITY.md](SECURITY.md).

**Atlas Developers — a product of Atlas Financial.**
