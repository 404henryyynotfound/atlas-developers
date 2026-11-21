#!/usr/bin/env bash
# Build a sudo-installable .pkg for the Atlas Developers CLI on macOS.
# Usage: bash packaging/build-pkg-cli.sh [output-dir]
set -euo pipefail

OUT_DIR="${1:-dist/packages}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(node -p "require('$ROOT/package.json').version")"

command -v pkgbuild >/dev/null 2>&1 || { echo "pkgbuild is required (macOS)" >&2; exit 1; }

STAGE="$(mktemp -d "${TMPDIR:-/tmp}/atlas-cli-pkg.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT

mkdir -p \
  "$STAGE/usr/local/bin" \
  "$STAGE/usr/local/lib/atlas-developers/cli/bin" \
  "$STAGE/usr/local/lib/atlas-developers/cli/src" \
  "$STAGE/usr/local/lib/atlas-developers/core/src"

install -m 0755 "$ROOT/cli/bin/atlas.js" \
  "$STAGE/usr/local/lib/atlas-developers/cli/bin/atlas.js"
install -m 0644 "$ROOT/cli/src/"*.js "$STAGE/usr/local/lib/atlas-developers/cli/src/"
install -m 0644 "$ROOT/core/src/"*.js "$STAGE/usr/local/lib/atlas-developers/core/src/"
ln -s ../lib/atlas-developers/cli/bin/atlas.js "$STAGE/usr/local/bin/atlas"

mkdir -p "$OUT_DIR"
OUT_FILE="$OUT_DIR/atlas-developers-cli-${VERSION}.pkg"
pkgbuild \
  --root "$STAGE" \
  --identifier com.atlasfinancial.developers.cli \
  --version "$VERSION" \
  --install-location / \
  "$OUT_FILE" >/dev/null
echo "$OUT_FILE"
