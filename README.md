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

## What's in this repository

| Path | Purpose |
| --- | --- |
| `core/` | Shared data model, atomic JSON store, deterministic insights and AI engine |
| `cli/` | Zero-dependency `atlas` command line tool |
| `gui/` | Electron shell that loads the web app and shares `~/.atlas-developers/data.json` |
| `web/` | Static no-bundler SPA, deployed to `atlas-developers.surge.sh` |
| `install.sh` | Curl-installable CLI installer (Linux/macOS, x64/arm64) |
| `.github/workflows/` | CI validation and tagged release builds for 6 targets |

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

## Download the GUI

All links point to the public GitHub Releases "latest" assets. Each GUI build
has a matching `.sha256` file (append `.sha256` to the asset URL).

| Platform | Architecture | GUI | CLI |
| --- | --- | --- | --- |
| Linux | x64 | [AppImage](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-gui-linux-x64.AppImage) · [DEB](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-gui-linux-x64.deb) · [tar.gz](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-gui-linux-x64.tar.gz) | [atlas-cli-linux-x64.tar.gz](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-cli-linux-x64.tar.gz) |
| Linux | arm64 | [AppImage](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-gui-linux-arm64.AppImage) · [DEB](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-gui-linux-arm64.deb) · [tar.gz](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-gui-linux-arm64.tar.gz) | [atlas-cli-linux-arm64.tar.gz](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-cli-linux-arm64.tar.gz) |
| macOS | x64 (Intel) | [DMG](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-gui-macos-x64.dmg) · [ZIP](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-gui-macos-x64.zip) | [atlas-cli-macos-x64.tar.gz](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-cli-macos-x64.tar.gz) |
| macOS | arm64 (Apple Silicon) | [DMG](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-gui-macos-arm64.dmg) · [ZIP](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-gui-macos-arm64.zip) | [atlas-cli-macos-arm64.tar.gz](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-cli-macos-arm64.tar.gz) |
| Windows | x64 | [EXE](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-gui-windows-x64.exe) · [ZIP](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-gui-windows-x64.zip) | [atlas-cli-windows-x64.tar.gz](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-cli-windows-x64.tar.gz) |
| Windows | arm64 | [EXE](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-gui-windows-arm64.exe) · [ZIP](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-gui-windows-arm64.zip) | [atlas-cli-windows-arm64.tar.gz](https://github.com/404henryyynotfound/atlas-developers/releases/latest/download/atlas-cli-windows-arm64.tar.gz) |

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

1. Update the version in `package.json`, `cli/package.json`, `gui/package.json`,
   `web/package.json`, `core/package.json` and `core/src/version.js`.
2. Commit and push to `main`; CI runs JavaScript syntax checks, `bash -n` on the
   installer, and `node cli/test.js`.
3. Tag and push:

   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

4. `.github/workflows/release.yml` builds six CLI archives plus SHA-256 files and
   six GUI builds plus SHA-256 files, then publishes them to the GitHub Release
   for that tag.
5. Deploy the static site separately with `npm run web:deploy`.

### Build caveats

- GUI builds are **unsigned**: no Apple Developer or Windows code-signing
  certificate is configured. macOS users may need right-click → Open; Windows
  SmartScreen may warn. CI sets `CSC_IDENTITY_AUTO_DISCOVERY=false` explicitly.
- Electron builder artifact naming follows `atlas-gui-${os}-${arch}.${ext}`.
  Some Linux formats (notably `deb` and AppImage) can append a version or
  revision in the package metadata even when the file name matches; if a future
  electron-builder version introduces a suffix, the download page links above
  are the canonical names to keep in sync.
- Linux arm64 GUI cross-builds from `ubuntu-latest` may require the
  `gcc-aarch64-linux-gnu` toolchain for native modules. The workflow installs it.
 macOS signing/notarization is not performed.
- The CLI is plain Node JavaScript, so the same archive works across CPU
  architectures once Node 20+ is available; separate archives are still built
  for all six targets to keep installer detection simple.

## License

MIT © Atlas Financial. See [LICENSE](LICENSE) and [SECURITY.md](SECURITY.md).

**Atlas Developers — a product of Atlas Financial.**
