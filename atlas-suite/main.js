/* Atlas Suite — one GUI for the Atlas Financial app family.
   Serves the bundled static apps from a loopback HTTP origin so their ES
   modules, hash routes and localStorage all behave like the hosted sites. */

const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = __dirname;
const WEB_ROOT = path.join(ROOT, 'web-build');
const DEFAULT_DATA_DIR = app.getPath('userData');
const DATA_DIR = process.env.ATLAS_SUITE_HOME
  ? path.resolve(process.env.ATLAS_SUITE_HOME)
  : DEFAULT_DATA_DIR;
app.setPath('userData', DATA_DIR);

const APPS = [
  { id: 'meridian', name: 'Meridian Finance', short: 'Meridian', glyph: '▤', route: '#/app/overview', color: '#5f8cff' },
  { id: 'airo', name: 'Airo Finance', short: 'Airo', glyph: '◉', route: '#/app/overview', color: '#4fd1c5' },
  { id: 'tandem', name: 'Tandem Finance', short: 'Tandem', glyph: '◈', route: '#/app/overview', color: '#a78bfa' },
  { id: 'business', name: 'Atlas Business', short: 'Business', glyph: '▣', route: '#/app/overview', color: '#f5a524' },
  { id: 'calendar', name: 'Atlas Calendar', short: 'Calendar', glyph: '▦', route: '#/overview', color: '#e8c268' },
  { id: 'developers', name: 'Atlas Developers', short: 'Developers', glyph: '⌘', route: '#/overview', color: '#34d399' },
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

let mainWindow = null;
let server = null;
let port = 0;

function ensureDataDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch { /* non-fatal */ }
}

function startServer() {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      let pathname;
      try {
        pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
      } catch {
        res.writeHead(400).end('Bad request');
        return;
      }

      const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      const full = path.resolve(WEB_ROOT, relative);
      if (full !== WEB_ROOT && !full.startsWith(`${WEB_ROOT}${path.sep}`)) {
        res.writeHead(403).end('Forbidden');
        return;
      }

      fs.stat(full, (err, stats) => {
        if (err || !stats.isFile()) {
          // Hash routes never reach the server; only extensionless routes fall
          // back to the shell. Missing modules must stay 404s so errors surface.
          if (path.extname(full)) {
            res.writeHead(404).end('Not found');
            return;
          }
          const shellFile = path.join(WEB_ROOT, 'index.html');
          fs.readFile(shellFile, (shellErr, data) => {
            if (shellErr) { res.writeHead(404).end('Not found'); return; }
            res.writeHead(200, { 'content-type': MIME['.html'] }).end(data);
          });
          return;
        }
        res.writeHead(200, {
          'content-type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream',
          'cache-control': 'no-cache',
        });
        fs.createReadStream(full).pipe(res);
      });
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      resolve(port);
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 960,
    minWidth: 1024,
    minHeight: 680,
    title: 'Atlas Suite',
    backgroundColor: '#0b1020',
    icon: path.join(ROOT, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(ROOT, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      sandbox: false,
      spellcheck: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(`http://127.0.0.1:${port}/index.html`);
  mainWindow.on('closed', () => { mainWindow = null; });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    ensureDataDir();
    try {
      await startServer();
      createWindow();
    } catch (error) {
      dialog.showErrorBox('Atlas Suite', `Could not start the local app server: ${error.message}`);
      app.quit();
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  app.on('before-quit', () => {
    if (server) server.close();
  });
}

ipcMain.handle('suite:apps', () => APPS);
ipcMain.handle('suite:version', () => app.getVersion());
ipcMain.handle('suite:data-dir', () => DATA_DIR);
ipcMain.handle('suite:open-data', async () => {
  ensureDataDir();
  const result = await shell.openPath(DATA_DIR);
  return result || 'ok';
});
ipcMain.handle('suite:open-external', async (_event, target) => {
  const raw = String(target || '');
  if (!/^https?:\/\//i.test(raw)) return 'blocked';
  await shell.openExternal(raw);
  return 'ok';
});
