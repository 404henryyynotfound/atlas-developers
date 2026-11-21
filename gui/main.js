'use strict';

/**
 * Electron shell for Atlas Developers.
 * The packaged app serves web/ from a loopback HTTP server because Chromium
 * blocks ES-module imports on file:// URLs. No external network access.
 */

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  app, BrowserWindow, ipcMain, shell, nativeImage
} = require('electron');

const PROTOCOL = 'atlasdev';
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

let server = null;
let windowRef = null;
let currentPort = 0;

function webDirectory() {
  const bundled = path.join(__dirname, 'web-build');
  return fs.existsSync(bundled) ? bundled : path.join(__dirname, '..', 'web');
}

function startServer() {
  const root = webDirectory();
  return new Promise((resolve, reject) => {
    const instance = http.createServer((request, response) => {
      let pathname = '/';
      try {
        pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      } catch (_) {
        pathname = '/';
      }
      if (pathname === '/' || pathname === '') pathname = '/index.html';
      const file = path.resolve(root, `.${pathname}`);
      if (file !== root && !file.startsWith(`${root}${path.sep}`)) {
        response.statusCode = 403;
        response.end('Forbidden');
        return;
      }
      fs.readFile(file, (error, contents) => {
        if (error) {
          response.statusCode = 404;
          response.end('Not found');
          return;
        }
        response.setHeader('content-type', MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
        response.setHeader('cache-control', 'no-store');
        response.end(contents);
      });
    });
    instance.on('error', reject);
    instance.listen(0, '127.0.0.1', () => resolve(instance));
  });
}

function createWindow() {
  const options = {
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#0b1116',
    title: 'Atlas Developers',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  };
  const icon = path.join(__dirname, 'assets', 'icon.svg');
  if (fs.existsSync(icon)) {
    try { options.icon = nativeImage.createFromPath(icon); } catch (_) { /* icon is optional */ }
  }
  windowRef = new BrowserWindow(options);
  windowRef.loadURL(`http://127.0.0.1:${currentPort}/#/overview`);
  windowRef.on('closed', () => { windowRef = null; });
}

function handleDeepLink(url) {
  if (!url || !String(url).startsWith(`${PROTOCOL}://`)) return;
  if (!windowRef) createWindow();
  else windowRef.webContents.send('atlas:deep-link', String(url));
  if (windowRef.isMinimized()) windowRef.restore();
  windowRef.focus();
}

function atlasDataFile() {
  const directory = process.env.ATLAS_HOME || path.join(os.homedir(), '.atlas-developers');
  return path.join(directory, 'data.json');
}

function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temp, file);
}

function bootstrap() {
  app.setAsDefaultProtocolClient(PROTOCOL);

  ipcMain.handle('atlas:get-version', () => app.getVersion());
  ipcMain.on('atlas:read-data-sync', (event) => {
    try {
      const file = atlasDataFile();
      event.returnValue = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
    } catch (_) {
      event.returnValue = null;
    }
  });
  ipcMain.on('atlas:write-data-sync', (event, value) => {
    try {
      writeJsonAtomic(atlasDataFile(), value || {});
      event.returnValue = true;
    } catch (_) {
      event.returnValue = false;
    }
  });
  ipcMain.handle('atlas:open-data-folder', () => {
    const directory = process.env.ATLAS_HOME || path.join(os.homedir(), '.atlas-developers');
    try { fs.mkdirSync(directory, { recursive: true }); } catch (_) { /* shell still reports path */ }
    return shell.openPath(directory);
  });

  app.whenReady().then(async () => {
    try {
      server = await startServer();
      currentPort = server.address().port;
      createWindow();
    } catch (error) {
      process.stderr.write(`atlas: could not start local web server: ${(error && error.message) || error}\n`);
      app.quit();
    }
  }).catch((error) => {
    process.stderr.write(`atlas: startup error: ${(error && error.message) || error}\n`);
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });

  app.on('second-instance', (event, argv) => {
    const link = argv.find((argument) => String(argument).startsWith(`${PROTOCOL}://`));
    if (link) handleDeepLink(link);
    else if (windowRef) {
      if (windowRef.isMinimized()) windowRef.restore();
      windowRef.focus();
    }
  });

  app.on('activate', () => {
    if (!windowRef && currentPort) createWindow();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    if (server) server.close();
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  bootstrap();
}
