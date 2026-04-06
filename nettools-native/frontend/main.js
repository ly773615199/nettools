const { app, BrowserWindow, Tray, Menu, nativeImage, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');
const dns = require('dns');

let mainWindow = null;
let tray = null;

// ========== IPC Handlers ==========

function registerIpcHandlers() {
  // 应用信息
  ipcMain.handle('app:getVersion', () => app.getVersion());
  ipcMain.handle('app:getPlatform', () => process.platform);
  ipcMain.handle('app:getAppPath', () => app.getAppPath());

  // 窗口控制
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('window:toggleFullscreen', () => {
    if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
  });
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);

  // 系统操作
  ipcMain.handle('system:openExternal', (_e, url) => shell.openExternal(url));
  ipcMain.handle('system:showItemInFolder', (_e, filePath) => shell.showItemInFolder(filePath));
  ipcMain.handle('system:getInfo', () => ({
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    hostname: os.hostname(),
    cpus: os.cpus().length,
    memory: os.totalmem(),
    freeMemory: os.freemem(),
    uptime: os.uptime(),
    homedir: os.homedir(),
    userInfo: os.userInfo().username,
  }));

  // 文件对话框
  ipcMain.handle('dialog:openFile', async (_e, options = {}) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: options.properties || ['openFile'],
      filters: options.filters || [{ name: 'All Files', extensions: ['*'] }],
    });
    return result.canceled ? null : result.filePaths;
  });

  ipcMain.handle('dialog:saveFile', async (_e, options = {}) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: options.defaultPath || '',
      filters: options.filters || [{ name: 'All Files', extensions: ['*'] }],
    });
    return result.canceled ? null : result.filePath;
  });

  // 网络工具
  ipcMain.handle('net:ping', (_e, host) => {
    return new Promise((resolve) => {
      const cmd = process.platform === 'win32'
        ? `ping -n 4 ${host}`
        : `ping -c 4 ${host}`;
      exec(cmd, { timeout: 10000 }, (err, stdout) => {
        if (err) {
          resolve({ success: false, output: err.message });
        } else {
          // 提取平均延迟
          const match = stdout.match(/avg[^=]*=\s*([\d.]+)/i)
            || stdout.match(/Average\s*=\s*([\d.]+)/i);
          resolve({
            success: true,
            output: stdout,
            avgLatency: match ? parseFloat(match[1]) : null,
          });
        }
      });
    });
  });

  ipcMain.handle('net:dnsLookup', (_e, hostname) => {
    return new Promise((resolve) => {
      dns.lookup(hostname, (err, address) => {
        if (err) resolve({ success: false, error: err.message });
        else resolve({ success: true, address });
      });
    });
  });

  // 进程管理
  ipcMain.handle('process:exec', (_e, command, args = []) => {
    return new Promise((resolve) => {
      const fullCmd = [command, ...args].join(' ');
      exec(fullCmd, { timeout: 30000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) resolve({ success: false, error: err.message, stderr });
        else resolve({ success: true, stdout, stderr });
      });
    });
  });

  ipcMain.handle('process:list', () => {
    return new Promise((resolve) => {
      const cmd = process.platform === 'win32' ? 'tasklist' : 'ps aux --no-headers';
      exec(cmd, { timeout: 5000 }, (err, stdout) => {
        if (err) resolve({ success: false, error: err.message });
        else resolve({ success: true, processes: stdout.trim().split('\n').slice(0, 50) });
      });
    });
  });

  // 更新检查 (占位，实际需要 electron-updater)
  ipcMain.handle('updater:check', () => {
    return { available: false, message: 'Auto-update not configured' };
  });
}

// ========== 窗口创建 ==========

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 600,
    title: 'NetTools',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, 'public', 'favicon.ico'),
    show: false,
  });

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ========== 系统托盘 ==========

function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开 NetTools',
      click: () => { mainWindow?.show(); mainWindow?.focus(); },
    },
    { type: 'separator' },
    {
      label: '开发者工具',
      click: () => mainWindow?.webContents.openDevTools(),
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => { app.isQuitting = true; app.quit(); },
    },
  ]);

  tray.setToolTip('NetTools');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

// ========== 应用生命周期 ==========

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    registerIpcHandlers();
    createWindow();
    createTray();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    // 不退出，保持托盘运行
  });

  app.on('before-quit', () => { app.isQuitting = true; });
}
