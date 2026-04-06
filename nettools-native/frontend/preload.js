// 预加载脚本 — 通过 IPC 暴露主进程能力给渲染进程
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ========== 应用信息 ==========
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
  getAppPath: () => ipcRenderer.invoke('app:getAppPath'),

  // ========== 窗口控制 ==========
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  toggleFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // ========== 系统操作 ==========
  openExternal: (url) => ipcRenderer.invoke('system:openExternal', url),
  showItemInFolder: (path) => ipcRenderer.invoke('system:showItemInFolder', path),
  getSystemInfo: () => ipcRenderer.invoke('system:getInfo'),

  // ========== 文件对话框 ==========
  openFileDialog: (options) => ipcRenderer.invoke('dialog:openFile', options),
  saveFileDialog: (options) => ipcRenderer.invoke('dialog:saveFile', options),

  // ========== 网络工具 (主进程级) ==========
  ping: (host) => ipcRenderer.invoke('net:ping', host),
  dnsLookup: (hostname) => ipcRenderer.invoke('net:dnsLookup', hostname),

  // ========== 进程管理 ==========
  execCommand: (command, args) => ipcRenderer.invoke('process:exec', command, args),
  getProcessList: () => ipcRenderer.invoke('process:list'),

  // ========== 托盘事件 ==========
  onTrayAction: (callback) => {
    ipcRenderer.on('tray:action', (_event, action) => callback(action));
  },

  // ========== 更新相关 ==========
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('updater:available', (_event, info) => callback(info));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('updater:downloaded', (_event, info) => callback(info));
  },

  // ========== 后端进程 ==========
  getBackendStatus: () => ipcRenderer.invoke('backend:status'),
  restartBackend: () => ipcRenderer.invoke('backend:restart'),

  // ========== 通用 IPC ==========
  send: (channel, data) => ipcRenderer.send(channel, data),
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, callback) => {
    const subscription = (_event, ...args) => callback(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },
});
