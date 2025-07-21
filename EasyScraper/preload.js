const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  checkLicense: () => ipcRenderer.invoke('check-license'),
  validateLicense: (key) => ipcRenderer.invoke('validate-license', key),
  startScraping: (options) => ipcRenderer.invoke('start-scraping', options),
  saveFile: (data, format) => ipcRenderer.invoke('save-file', data, format),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  
  // Listen for progress updates
  onScrapingProgress: (callback) => {
    ipcRenderer.on('scraping-progress', callback);
  },
  
  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});