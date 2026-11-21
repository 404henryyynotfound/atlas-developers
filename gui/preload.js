'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/** Minimal, explicit bridge. No filesystem or Node access is exposed to the page. */
contextBridge.exposeInMainWorld('atlasDesktop', {
  platform: process.platform,
  getVersion: () => ipcRenderer.invoke('atlas:get-version'),
  openDataFolder: () => ipcRenderer.invoke('atlas:open-data-folder'),
  readDataSync: () => ipcRenderer.sendSync('atlas:read-data-sync'),
  writeDataSync: (value) => ipcRenderer.sendSync('atlas:write-data-sync', value),
  onDeepLink: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (event, url) => callback(url);
    ipcRenderer.on('atlas:deep-link', listener);
    return () => ipcRenderer.removeListener('atlas:deep-link', listener);
  }
});
