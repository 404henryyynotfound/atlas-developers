/** OS/arch detection and download cards. */

import { APP, PLATFORMS, assetUrl } from './config.js';
import { esc, copyText } from './utils.js';

export async function detectPlatform() {
  const nav = typeof navigator === 'undefined' ? {} : navigator;
  const ua = String(nav.userAgent || '').toLowerCase();
  let highEntropy = '';
  let platformHint = '';
  const uaData = nav.userAgentData;
  if (uaData && typeof uaData.getHighEntropyValues === 'function') {
    try {
      const hints = await uaData.getHighEntropyValues(['architecture', 'bitness', 'platform']);
      highEntropy = `${hints.architecture || ''} ${hints.bitness || ''}`.toLowerCase();
      platformHint = String(hints.platform || '').toLowerCase();
    } catch (_) { /* privacy settings can block high entropy values */ }
  }

  const platformText = platformHint || String(uaData && uaData.platform || '').toLowerCase() || ua;
  let os = 'linux';
  if (/mac|darwin|iphone|ipad/.test(platformText) || /macintosh|mac os x/.test(ua)) os = 'macos';
  else if (/win|windows/.test(platformText) || /windows/.test(ua)) os = 'windows';

  let arch = 'x64';
  if (/arm64|aarch64/.test(highEntropy) || /arm64|aarch64/.test(ua)) arch = 'arm64';
  else if (/macintel/.test(ua) && numTouch(nav) > 1) arch = 'arm64';

  const platform = PLATFORMS.find((item) => item.os === os && item.arch === arch) || PLATFORMS[0];
  return { os, arch, platform, label: `${platform.label} · ${platform.archLabel}` };
}

function numTouch(nav) {
  return Number(nav.maxTouchPoints || 0);
}

function card(platform, detected) {
  const isDetected = detected && detected.os === platform.os && detected.arch === platform.arch;
  const guiLinks = platform.gui.map((item) => (
    `<a class="asset-link" href="${esc(assetUrl(item.file))}">${esc(item.label)} <span>↗</span></a>`
  )).join('');
  const checksums = [...platform.gui.map((item) => `${item.file}.sha256`), `${platform.cli}.sha256`]
    .map((file) => `<a class="checksum-link" href="${esc(assetUrl(file))}">${esc(file.replace('atlas-gui-', 'gui-').replace('atlas-cli-', 'cli-'))}</a>`)
    .join('');
  return `<article class="download-card${isDetected ? ' is-detected' : ''}" data-os="${esc(platform.os)}" data-arch="${esc(platform.arch)}">
    ${isDetected ? '<div class="detected-badge">YOUR DEVICE</div>' : ''}
    <div class="download-icon">${esc(platform.icon)}</div>
    <h3>${esc(platform.label)} <span>${esc(platform.archLabel)}</span></h3>
    <div class="download-group"><span class="download-group-label">GUI</span>${guiLinks}</div>
    <div class="download-group"><span class="download-group-label">CLI</span>
      <a class="asset-link" href="${esc(assetUrl(platform.cli))}">${esc(platform.cli)} <span>↓</span></a>
    </div>
    <div class="checksums"><span class="download-group-label">SHA-256</span>${checksums}</div>
  </article>`;
}

export function downloadsMarkup(detected) {
  return `<div class="download-grid">${PLATFORMS.map((platform) => card(platform, detected)).join('')}</div>`;
}

export function installMarkup() {
  return `<div class="install-block">
    <div class="install-head"><span class="prompt">$</span><code id="install-command">${esc(APP.installCommand)}</code>
      <button class="btn btn-small" type="button" data-copy="${esc(APP.installCommand)}">Copy</button>
    </div>
    <p>macOS and Linux. Pin a version with <code>ATLAS_VERSION=1.0.0</code>. Windows users can download the CLI archive above and run <code>bin/atlas.js</code> with Node 20+.</p>
  </div>`;
}

export function mountDownloads(container) {
  if (!container) return;
  detectPlatform().then((detected) => {
    container.innerHTML = `${installMarkup()}
      <p class="detected-line">Detected: <strong>${esc(detected.label)}</strong> — highlighted below. Wrong platform? Use the links for your device.</p>
      ${downloadsMarkup(detected)}`;
  }).catch(() => {
    container.innerHTML = `${installMarkup()}${downloadsMarkup(null)}`;
  });
  if (!container._atlasCopyBound) {
    container._atlasCopyBound = true;
    container.addEventListener('click', (event) => {
      const button = event.target.closest('[data-copy]');
      if (!button) return;
      copyText(button.getAttribute('data-copy') || '').then((ok) => {
        const original = button.textContent;
        button.textContent = ok ? 'Copied' : 'Select manually';
        setTimeout(() => { button.textContent = original; }, 1800);
      });
    });
  }
}
