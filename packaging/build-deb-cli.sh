#!/usr/bin/env bash
# Build a sudo-installable .deb for the Atlas Developers CLI.
# Usage: bash packaging/build-deb-cli.sh [amd64|arm64] [output-dir]
set -euo pipefail

ARCH_INPUT="${1:-amd64}"
OUT_DIR="${2:-dist/packages}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(node -p "require('$ROOT/package.json').version")"

case "$ARCH_INPUT" in
  x64|amd64) DEB_ARCH="amd64" ;;
  arm64|aarch64) DEB_ARCH="arm64" ;;
  *) echo "Unsupported architecture: $ARCH_INPUT" >&2; exit 1 ;;
esac

command -v dpkg-deb >/dev/null 2>&1 || { echo "dpkg-deb is required" >&2; exit 1; }

STAGE="$(mktemp -d "${TMPDIR:-/tmp}/atlas-cli-deb.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT

mkdir -p \
  "$STAGE/DEBIAN" \
  "$STAGE/usr/bin" \
  "$STAGE/usr/lib/atlas-developers/cli/bin" \
  "$STAGE/usr/lib/atlas-developers/cli/src" \
  "$STAGE/usr/lib/atlas-developers/core/src" \
  "$STAGE/usr/share/doc/atlas-developers-cli" \
  "$OUT_DIR"

cat > "$STAGE/DEBIAN/control" <<EOF
Package: atlas-developers-cli
Version: $VERSION
Section: utils
Priority: optional
Architecture: $DEB_ARCH
Maintainer: Atlas Financial <support@atlas-developers.surge.sh>
Homepage: https://atlas-developers.surge.sh
Description: Zero-dependency Atlas Developers command line tool
 Track payments, invoices, clients, time and subscriptions from the terminal.
 Data stays local in ~/.atlas-developers/. Requires Node.js 20 or newer.
EOF

install -m 0755 "$ROOT/cli/bin/atlas.js" \
  "$STAGE/usr/lib/atlas-developers/cli/bin/atlas.js"
install -m 0644 "$ROOT/cli/src/"*.js "$STAGE/usr/lib/atlas-developers/cli/src/"
install -m 0644 "$ROOT/core/src/"*.js "$STAGE/usr/lib/atlas-developers/core/src/"
install -m 0644 "$ROOT/README.md" \
  "$STAGE/usr/share/doc/atlas-developers-cli/README.md"
install -m 0644 "$ROOT/LICENSE" \
  "$STAGE/usr/share/doc/atlas-developers-cli/copyright"

ln -s ../lib/atlas-developers/cli/bin/atlas.js "$STAGE/usr/bin/atlas"

OUT_FILE="$OUT_DIR/atlas-developers-cli_${VERSION}_${DEB_ARCH}.deb"
dpkg-deb --build --root-owner-group "$STAGE" "$OUT_FILE" >/dev/null
echo "$OUT_FILE"
