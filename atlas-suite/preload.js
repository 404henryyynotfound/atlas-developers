const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('atlasSuite', {
  platform: process.platform,
  getApps: () => ipcRenderer.invoke('suite:apps'),
  getVersion: () => ipcRenderer.invoke('suite:version'),
  getDataDir: () => ipcRenderer.invoke('suite:data-dir'),
  openDataFolder: () => ipcRenderer.invoke('suite:open-data'),
  openExternal: (url) => ipcRenderer.invoke('suite:open-external', url),
});
