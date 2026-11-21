#!/usr/bin/env bash
# Build a sudo-installable macOS .pkg for the Atlas Developers GUI.
# Usage: build-pkg-gui.sh <path-to-atlas-developers.app> <output.pkg> [version]
set -euo pipefail

APP_DIR="${1:?usage: build-pkg-gui.sh <app-bundle> <output.pkg> [version]}"
OUTPUT="${2:?usage: build-pkg-gui.sh <app-bundle> <output.pkg> [version]}"
VERSION="${3:-1.0.0}"

if [ ! -d "$APP_DIR" ]; then
  echo "App bundle not found: $APP_DIR" >&2
  exit 1
fi
if ! command -v pkgbuild >/dev/null 2>&1; then
  echo "pkgbuild is required (macOS with Xcode command line tools)" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT")"
pkgbuild \
  --component "$APP_DIR" \
  --identifier com.atlasfinancial.developers.gui \
  --version "$VERSION" \
  --install-location /Applications \
  "$OUTPUT"

echo "Built $OUTPUT"
