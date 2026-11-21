#!/usr/bin/env node
'use strict';

/**
 * atlas-developers-gui
 *
 * Downloads, verifies and launches the correct Atlas Developers GUI artifact
 * from GitHub Releases. The binary is cached under ~/.atlas-developers/gui/.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');

const pkg = require('../package.json');
const RELEASE_BASE = 'https://github.com/404henryyynotfound/atlas-developers/releases/download';
const VERSION = String(process.env.ATLAS_VERSION || pkg.version).replace(/^v/, '');
const args = process.argv.slice(2);

function platform() {
  return process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : 'linux';
}

function arch() {
  const value = process.processArch || process.arch;
  return value === 'arm64' || value === 'aarch64' ? 'arm64' : 'x64';
}

function assetName() {
  if (process.env.ATLAS_GUI_ASSET) return process.env.ATLAS_GUI_ASSET;
  const p = platform();
  const a = arch();
  if (p === 'linux') return `atlas-gui-linux-${a}.AppImage`;
  if (p === 'macos') return `atlas-gui-macos-${a}.zip`;
  return `atlas-gui-windows-${a}.zip`;
}

function assetUrl(name) {
  return `${RELEASE_BASE}/v${VERSION}/${name}`;
}

function cacheDir() {
  return process.env.ATLAS_GUI_HOME || path.join(os.homedir(), '.atlas-developers', 'gui', VERSION);
}

function requestStream(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'atlas-developers-gui' } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        if (redirects >= 5) return reject(new Error('Too many redirects while downloading'));
        return resolve(requestStream(new URL(res.headers.location, url).toString(), redirects + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`Download failed (${res.statusCode}): ${url}`));
      }
      return resolve(res);
    });
    req.on('error', reject);
  });
}

async function download(url, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temp = `${destination}.${process.pid}.part`;
  const stream = await requestStream(url);
  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream(temp, { mode: 0o755 });
    stream.on('error', reject);
    file.on('error', reject);
    file.on('finish', resolve);
    stream.pipe(file);
  });
  fs.renameSync(temp, destination);
  return destination;
}

function readStream(stream) {
  return new Promise((resolve, reject) => {
    let data = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => { data += chunk; });
    stream.on('end', () => resolve(data));
    stream.on('error', reject);
  });
}

async function verify(destination, asset) {
  const checksumStream = await requestStream(assetUrl(`${asset}.sha256`));
  const content = await readStream(checksumStream);
  const match = /(?:^|\s)([a-f0-9]{64})(?:\s|$)/i.exec(content);
  if (!match) throw new Error(`Checksum file for ${asset} is malformed`);
  const actual = crypto.createHash('sha256').update(fs.readFileSync(destination)).digest('hex');
  if (actual.toLowerCase() !== match[1].toLowerCase()) {
    throw new Error(`Checksum mismatch for ${asset}`);
  }
}

function run(command, cmdArgs, options = {}) {
  const result = spawnSync(command, cmdArgs, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status}`);
}

function walk(directory) {
  const entries = [];
  for (const name of fs.readdirSync(directory)) {
    const full = path.join(directory, name);
    const stats = fs.lstatSync(full);
    if (stats.isDirectory()) entries.push(...walk(full));
    else entries.push(full);
  }
  return entries;
}

function extract(archive, destination) {
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(destination, { recursive: true });
  if (archive.endsWith('.tar.gz')) {
    run('tar', ['-xzf', archive, '-C', destination]);
    return destination;
  }
  if (archive.endsWith('.zip') && process.platform === 'win32') {
    const escaped = (value) => value.replace(/'/g, "''");
    run('powershell.exe', [
      '-NoProfile', '-Command',
      `Expand-Archive -LiteralPath '${escaped(archive)}' -DestinationPath '${escaped(destination)}' -Force`
    ]);
    return destination;
  }
  if (archive.endsWith('.zip')) {
    run('unzip', ['-o', archive, '-d', destination]);
    return destination;
  }
  return archive;
}

function locateLauncher(archive, extracted) {
  if (archive.endsWith('.AppImage')) return { command: archive, appArgs: [] };

  const files = fs.existsSync(extracted) ? walk(extracted) : [];
  if (process.platform === 'darwin') {
    const app = files.find((file) => file.endsWith('.app'));
    if (app) return { command: 'open', appArgs: [app] };
  }
  if (process.platform === 'win32') {
    const exe = files.find((file) => file.toLowerCase().endsWith('.exe')
      && !/uninstall|helper|elevate/i.test(path.basename(file)));
    if (exe) return { command: exe, appArgs: [] };
  }
  const appImage = files.find((file) => file.endsWith('.AppImage'));
  if (appImage) {
    fs.chmodSync(appImage, 0o755);
    return { command: appImage, appArgs: [] };
  }
  const executable = files.find((file) => /atlas[ -]?developers/i.test(path.basename(file)));
  if (executable) {
    fs.chmodSync(executable, 0o755);
    return { command: executable, appArgs: [] };
  }
  throw new Error('Could not find the GUI executable inside the downloaded artifact');
}

async function main() {
  if (args.includes('--version')) {
    process.stdout.write(`atlas-developers-gui ${pkg.version}\n`);
    return;
  }

  const asset = assetName();
  const dir = cacheDir();
  const archive = path.join(dir, asset);
  const plan = {
    version: VERSION,
    platform: platform(),
    arch: arch(),
    asset,
    url: assetUrl(asset),
    cache: dir,
    checksum: assetUrl(`${asset}.sha256`)
  };

  if (args.includes('--dry-run')) {
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    return;
  }

  if (!fs.existsSync(archive)) {
    process.stdout.write(`Downloading ${asset}...\n`);
    await download(assetUrl(asset), archive);
    await verify(archive, asset);
    process.stdout.write('Checksum verified.\n');
  }

  const extracted = path.join(dir, `extracted-${path.basename(asset, path.extname(asset))}`);
  const needsExtract = asset.endsWith('.zip') || asset.endsWith('.tar.gz');
  if (needsExtract && !fs.existsSync(extracted)) extract(archive, extracted);
  if (asset.endsWith('.AppImage')) fs.chmodSync(archive, 0o755);

  const launcher = locateLauncher(archive, extracted);
  const child = spawn(launcher.command, [...launcher.appArgs, ...args], { stdio: 'inherit' });
  child.on('error', (error) => {
    process.stderr.write(`atlas-gui: ${error.message}\n`);
    process.exitCode = 1;
  });
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exitCode = code === null ? 0 : code;
  });
}

main().catch((error) => {
  process.stderr.write(`atlas-gui: ${(error && error.message) || error}\n`);
  process.exitCode = 1;
});
