'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// 렌더러에 안전한 API만 노출 (nodeIntegration 비활성)
contextBridge.exposeInMainWorld('api', {
  scan: () => ipcRenderer.invoke('scan'),
  plan: (ids) => ipcRenderer.invoke('plan', ids),
  remove: (ids) => ipcRenderer.invoke('remove', ids),
});
