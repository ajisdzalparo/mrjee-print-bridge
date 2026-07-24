// ============================================================
// Electron Preload Script — Expose safe APIs to renderer
// ============================================================

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => '1.0.0',
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  getAutoStart: () => ipcRenderer.invoke('get-auto-start'),
  setAutoStart: (enabled: boolean) => ipcRenderer.invoke('set-auto-start', enabled),
  getLicenseStatus: () => ipcRenderer.invoke('license-status'),
  activateLicense: (licenseKey: string, apiToken: string) =>
    ipcRenderer.invoke('license-activate', { licenseKey, apiToken }),
  getApiToken: () => ipcRenderer.invoke('api-token-get'),
});
