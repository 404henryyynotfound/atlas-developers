# Security policy

Atlas Developers is local-first. There are no accounts, no OAuth/Google sign-in,
no payment processor APIs, and no bank APIs. Nothing is uploaded unless you
explicitly configure a sync endpoint or an external AI endpoint.

## Supported versions

Security fixes are applied to the latest `vX.Y.Z` tag.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting on
`404henryyynotfound/atlas-developers`, or open a security advisory rather than
a public issue. Include reproduction steps and affected version. Please do not
post secrets, API keys, or customer data in reports.

## Secrets and configuration

- No credentials, API keys, or tokens are committed to this repository.
- CLI config lives at `~/.atlas-developers/config.json` (override with `ATLAS_HOME`).
- Browser config lives in that browser's local storage.
- Optional external AI uses `ATLAS_AI_ENDPOINT` + `ATLAS_AI_KEY` (or GUI settings).
  Keys are sent only to the endpoint you configure and are never logged.
- Optional sync uses a bearer token passed as `?token=` to your own `atlas-sync`
  deployment (`developer` app slug). Use HTTPS.

## Downloads

Always verify a release with its `.sha256` file:

```bash
sha256sum -c atlas-cli-linux-x64.tar.gz.sha256
# macOS
shasum -a 256 -c atlas-cli-macos-arm64.tar.gz.sha256
```

GUI releases are currently **unsigned** because no code-signing identity is
configured in CI. macOS may require right-click → Open, and Windows SmartScreen
may warn on first run. This is expected for unsigned builds, not a reason to
disable your platform's security settings permanently.

## Data safety

Exports are plain JSON. Back up `~/.atlas-developers/data.json` (CLI/GUI) or use
Settings → Export JSON in the browser dashboard. `atlas import <file>` replaces
the local dataset after normalization, so export before importing.
