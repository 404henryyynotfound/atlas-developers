#!/usr/bin/env bash
# Atlas Developers CLI installer.
#   curl -fsSL https://raw.githubusercontent.com/404henryyynotfound/atlas-developers/main/install.sh | bash
# Pin a release with: ATLAS_VERSION=1.0.0 ... | bash
set -euo pipefail

REPO="404henryyynotfound/atlas-developers"
INSTALL_DIR="${ATLAS_INSTALL_DIR:-${HOME}/.local/bin}"
SHARE_DIR="${ATLAS_SHARE_DIR:-${HOME}/.local/share/atlas-developers}"
VERSION="${ATLAS_VERSION:-latest}"
CURL_BIN="${CURL_BIN:-}"

die() { printf 'atlas installer: error: %s\n' "$*" >&2; exit 1; }
info() { printf 'atlas installer: %s\n' "$*"; }

command -v uname >/dev/null 2>&1 || die "uname is required."
command -v tar >/dev/null 2>&1 || die "tar is required."

OS_RAW="$(uname -s)"
ARCH_RAW="$(uname -m)"

case "$OS_RAW" in
  Linux*) OS="linux" ;;
  Darwin*) OS="macos" ;;
  *) die "unsupported operating system: ${OS_RAW} (this installer supports Linux and macOS only)" ;;
esac

case "$ARCH_RAW" in
  x86_64|amd64) ARCH="x64" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *) die "unsupported architecture: ${ARCH_RAW} (expected x86_64/amd64 or arm64/aarch64)" ;;
esac

if [ -n "$CURL_BIN" ]; then
  DOWNLOADER="$CURL_BIN"
elif command -v curl >/dev/null 2>&1; then
  DOWNLOADER="curl"
elif command -v wget >/dev/null 2>&1; then
  DOWNLOADER="wget"
else
  die "curl or wget is required to download the CLI archive."
fi

fetch() {
  local url="$1"
  local output="$2"
  if [ "$DOWNLOADER" = "curl" ]; then
    curl -fsSL --retry 3 --connect-timeout 10 "$url" -o "$output"
  elif [ "$DOWNLOADER" = "wget" ]; then
    wget -q --tries=3 --timeout=20 "$url" -O "$output"
  else
    "$DOWNLOADER" -fsSL --retry 3 --connect-timeout 10 "$url" -o "$output"
  fi
}

ASSET="atlas-cli-${OS}-${ARCH}.tar.gz"
CHECKSUM_ASSET="${ASSET}.sha256"

if [ "$VERSION" = "latest" ] || [ -z "$VERSION" ]; then
  BASE_URL="https://github.com/${REPO}/releases/latest/download"
  LABEL="latest"
else
  TAG="$VERSION"
  case "$TAG" in
    v*) ;;
    *) TAG="v${TAG}" ;;
  esac
  BASE_URL="https://github.com/${REPO}/releases/download/${TAG}"
  LABEL="$TAG"
fi

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/atlas-install.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT

info "platform: ${OS}/${ARCH} · release: ${LABEL}"
info "downloading ${ASSET}"
fetch "${BASE_URL}/${ASSET}" "${TMP_DIR}/${ASSET}" || die "could not download ${BASE_URL}/${ASSET}. Check that release ${LABEL} exists."
fetch "${BASE_URL}/${CHECKSUM_ASSET}" "${TMP_DIR}/${CHECKSUM_ASSET}" || die "could not download checksum file ${CHECKSUM_ASSET}."

EXPECTED="$(awk 'NR==1 {print $1}' "${TMP_DIR}/${CHECKSUM_ASSET}")"
[ -n "$EXPECTED" ] || die "checksum file is empty or malformed."

ACTUAL=""
if command -v sha256sum >/dev/null 2>&1; then
  ACTUAL="$(sha256sum "${TMP_DIR}/${ASSET}" | awk '{print $1}')"
elif command -v shasum >/dev/null 2>&1; then
  ACTUAL="$(shasum -a 256 "${TMP_DIR}/${ASSET}" | awk '{print $1}')"
else
  die "sha256sum or shasum is required to verify the download."
fi

if [ "$EXPECTED" != "$ACTUAL" ]; then
  die "checksum mismatch for ${ASSET}. Expected ${EXPECTED}, got ${ACTUAL}."
fi
info "checksum verified"

mkdir -p "${TMP_DIR}/extract"
tar -xzf "${TMP_DIR}/${ASSET}" -C "${TMP_DIR}/extract"

SOURCE_DIR="${TMP_DIR}/extract"
if [ -d "${TMP_DIR}/extract/atlas-cli-${OS}-${ARCH}" ]; then
  SOURCE_DIR="${TMP_DIR}/extract/atlas-cli-${OS}-${ARCH}"
fi
[ -f "${SOURCE_DIR}/cli/bin/atlas.js" ] || die "archive is missing cli/bin/atlas.js."

TARGET_DIR="${SHARE_DIR}/${OS}-${ARCH}-${LABEL}"
mkdir -p "$TARGET_DIR"
cp -R "${SOURCE_DIR}/." "${TARGET_DIR}/"
chmod +x "${TARGET_DIR}/cli/bin/atlas.js"

mkdir -p "$INSTALL_DIR"
LINK_PATH="${INSTALL_DIR}/atlas"
if [ -L "$LINK_PATH" ] || [ -e "$LINK_PATH" ]; then
  rm -f "$LINK_PATH"
fi
ln -s "${TARGET_DIR}/cli/bin/atlas.js" "$LINK_PATH"

info "installed atlas to ${LINK_PATH}"
info "data will be stored in ${HOME}/.atlas-developers"

case ":${PATH}:" in
  *":${INSTALL_DIR}:"*) ;;
  *)
    printf '\n%s\n' "Add ${INSTALL_DIR} to your PATH:"
    printf '  export PATH="%s:$PATH"\n' "$INSTALL_DIR"
    ;;
esac

printf '\n%s\n' "Run: atlas init && atlas ai insight"
