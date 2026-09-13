/**
 * Beat Slash – Electron Preload Script
 * Securely exposes native window controls and Python process status to the renderer.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  fullscreen: () => ipcRenderer.invoke('window-fullscreen'),

  // Python hand tracker management
  getPythonStatus: () => ipcRenderer.invoke('get-python-status'),
  restartPython: () => ipcRenderer.invoke('restart-python'),

  // Platform info
  platform: process.platform,
  isElectron: true,
});
