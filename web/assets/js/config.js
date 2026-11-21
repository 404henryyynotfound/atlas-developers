/** Static configuration. No secrets are stored here. */

const injected = (typeof window !== 'undefined' && window.ATLAS_CONFIG && typeof window.ATLAS_CONFIG === 'object')
  ? window.ATLAS_CONFIG
  : {};

export const APP = {
  name: 'Atlas Developers',
  tagline: 'Tools for the work behind the money.',
  productOf: 'A product of Atlas Financial.',
  owner: '404henryyynotfound',
  repo: '404henryyynotfound/atlas-developers',
  rawBase: 'https://raw.githubusercontent.com/404henryyynotfound/atlas-developers/main',
  releasesBase: 'https://github.com/404henryyynotfound/atlas-developers/releases/latest/download',
  deployUrl: 'https://atlas-developers.surge.sh',
  installCommand: 'curl -fsSL https://raw.githubusercontent.com/404henryyynotfound/atlas-developers/main/install.sh | bash',
  deepLink: 'atlasdev://'
};

export const RUNTIME = {
  aiEndpoint: injected.aiEndpoint || '',
  aiKey: injected.aiKey || '',
  aiModel: injected.aiModel || '',
  syncEndpoint: injected.syncEndpoint || '',
  syncToken: injected.syncToken || ''
};

export const PLATFORMS = [
  {
    os: 'linux', arch: 'x64', label: 'Linux', archLabel: 'x64', icon: '🐧',
    cli: 'atlas-cli-linux-x64.tar.gz',
    gui: [
      { label: 'AppImage', file: 'atlas-gui-linux-x64.AppImage' },
      { label: 'DEB', file: 'atlas-gui-linux-x64.deb' },
      { label: 'Snap', file: 'atlas-developers_1.0.4_amd64.snap' },
      { label: 'tar.gz', file: 'atlas-gui-linux-x64.tar.gz' }
    ]
  },
  {
    os: 'linux', arch: 'arm64', label: 'Linux', archLabel: 'ARM64', icon: '🐧',
    cli: 'atlas-cli-linux-arm64.tar.gz',
    gui: [
      { label: 'AppImage', file: 'atlas-gui-linux-arm64.AppImage' },
      { label: 'DEB', file: 'atlas-gui-linux-arm64.deb' },
      { label: 'Snap', file: 'atlas-developers_1.0.4_arm64.snap' },
      { label: 'tar.gz', file: 'atlas-gui-linux-arm64.tar.gz' }
    ]
  },
  {
    os: 'macos', arch: 'x64', label: 'macOS', archLabel: 'Intel', icon: '🍎',
    cli: 'atlas-cli-macos-x64.tar.gz',
    gui: [
      { label: 'DMG', file: 'atlas-gui-macos-x64.dmg' },
      { label: 'ZIP', file: 'atlas-gui-macos-x64.zip' }
    ]
  },
  {
    os: 'macos', arch: 'arm64', label: 'macOS', archLabel: 'Apple Silicon', icon: '🍎',
    cli: 'atlas-cli-macos-arm64.tar.gz',
    gui: [
      { label: 'DMG', file: 'atlas-gui-macos-arm64.dmg' },
      { label: 'ZIP', file: 'atlas-gui-macos-arm64.zip' }
    ]
  },
  {
    os: 'windows', arch: 'x64', label: 'Windows', archLabel: 'x64', icon: '⊞',
    cli: 'atlas-cli-windows-x64.tar.gz',
    gui: [
      { label: 'EXE', file: 'atlas-gui-windows-x64.exe' },
      { label: 'ZIP', file: 'atlas-gui-windows-x64.zip' }
    ]
  },
  {
    os: 'windows', arch: 'arm64', label: 'Windows', archLabel: 'ARM64', icon: '⊞',
    cli: 'atlas-cli-windows-arm64.tar.gz',
    gui: [
      { label: 'EXE', file: 'atlas-gui-windows-arm64.exe' },
      { label: 'ZIP', file: 'atlas-gui-windows-arm64.zip' }
    ]
  }
];

export function assetUrl(file) {
  return `${APP.releasesBase}/${encodeURIComponent(file)}`;
}

export const ROUTES = [
  ['overview', 'Overview', '◫'],
  ['payments', 'Payments', '⇄'],
  ['invoices', 'Invoices', '▤'],
  ['clients', 'Clients', '◎'],
  ['projects', 'Projects', '◇'],
  ['subscriptions', 'Subscriptions', '↻'],
  ['time', 'Time', '◷'],
  ['payouts', 'Payouts', '↗'],
  ['goals', 'Goals', '⌖'],
  ['insights', 'Insights', '✦'],
  ['downloads', 'Downloads', '↓'],
  ['settings', 'Settings', '⚙']
];

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'INR', 'BRL', 'NGN', 'ZAR'];
