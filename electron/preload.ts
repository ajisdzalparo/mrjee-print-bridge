// ============================================================
// Electron Preload Script — Expose safe APIs to renderer
// ============================================================

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('update-check').then((status) => status.currentVersion),
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  getAutoStart: () => ipcRenderer.invoke('get-auto-start'),
  setAutoStart: (enabled: boolean) => ipcRenderer.invoke('set-auto-start', enabled),
  getLicenseStatus: () => ipcRenderer.invoke('license-status'),
  activateLicense: (licenseKey: string, apiToken: string) =>
    ipcRenderer.invoke('license-activate', { licenseKey, apiToken }),
  getApiToken: () => ipcRenderer.invoke('api-token-get'),
  checkForUpdates: (force = false) => ipcRenderer.invoke('update-check', force),
  openUpdate: (url: string) => ipcRenderer.invoke('update-open', url),
});
