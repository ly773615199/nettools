const { app, BrowserWindow, Tray, Menu, nativeImage, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const { exec, fork } = require('child_process');
const os = require('os');
const dns = require('dns');
const http = require('http');

let mainWindow = null;
let tray = null;
let backendProcess = null;
let backendReady = false;

// ========== 后端进程管理 ==========

const BACKEND_PORT = process.env.BACKEND_PORT || 8000;
const isDev = process.env.NODE_ENV === 'development';

// 打包后后端在 extraResources/backend，开发时在 ../nettools-backend-node
const BACKEND_DIR = isDev
  ? path.join(__dirname, '..', 'nettools-backend-node')
  : path.join(process.resourcesPath, 'backend');
const BACKEND_ENTRY = path.join(BACKEND_DIR, 'src', 'index.js');

/**
 * 检测后端是否已就绪（轮询 /health）
 */
function waitForBackend(maxWaitMs = 15000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      http.get(`http://localhost:${BACKEND_PORT}/health`, { timeout: 2000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            backendReady = true;
            resolve(true);
          } else if (Date.now() - start < maxWaitMs) {
            setTimeout(check, 500);
          } else {
            resolve(false);
          }
        });
      }).on('error', () => {
        if (Date.now() - start < maxWaitMs) {
          setTimeout(check, 500);
        } else {
          resolve(false);
        }
      });
    };
    check();
  });
}

/**
 * 启动后端子进程
 */
async function startBackend() {
  // 如果后端已在运行（外部启动），跳过
  const alreadyRunning = await new Promise((resolve) => {
    http.get(`http://localhost:${BACKEND_PORT}/health`, { timeout: 1000 }, (res) => {
      resolve(res.statusCode === 200);
    }).on('error', () => resolve(false));
  });

  if (alreadyRunning) {
    console.log('[Backend] Already running on port', BACKEND_PORT);
    backendReady = true;
    return true;
  }

  console.log('[Backend] Starting backend process...');
  console.log('[Backend] Entry:', BACKEND_ENTRY);

  try {
    backendProcess = fork(BACKEND_ENTRY, [], {
      cwd: BACKEND_DIR,
      env: { ...process.env, PORT: BACKEND_PORT, NODE_ENV: isDev ? 'development' : 'production' },
      silent: false,
    });

    backendProcess.on('error', (err) => {
      console.error('[Backend] Process error:', err.message);
      backendReady = false;
    });

    backendProcess.on('exit', (code, signal) => {
      console.log('[Backend] Process exited:', code, signal);
      backendReady = false;
      backendProcess = null;
    });

    // 等待后端就绪
    const ready = await waitForBackend(20000);
    if (ready) {
      console.log('[Backend] Ready on port', BACKEND_PORT);
    } else {
      console.error('[Backend] Timed out waiting for backend');
    }
    return ready;
  } catch (err) {
    console.error('[Backend] Failed to start:', err.message);
    return false;
  }
}

/**
 * 停止后端子进程
 */
function stopBackend() {
  if (backendProcess) {
    console.log('[Backend] Stopping...');
    backendProcess.kill('SIGTERM');
    backendProcess = null;
    backendReady = false;
  }
}

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

  // 后端进程管理
  ipcMain.handle('backend:status', () => ({
    running: backendReady,
    port: BACKEND_PORT,
    pid: backendProcess?.pid || null,
  }));

  ipcMain.handle('backend:restart', async () => {
    stopBackend();
    await new Promise(r => setTimeout(r, 1000));
    return startBackend();
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
    backgroundColor: '#1a1a2e',
  });

  // 加载前端
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // 通知渲染进程后端状态
    if (backendReady) {
      mainWindow.webContents.send('backend:ready', { port: BACKEND_PORT });
    } else {
      mainWindow.webContents.send('backend:error', { message: 'Backend failed to start' });
    }
  });

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

  // Dev 模式自动打开 DevTools
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

// ========== 系统托盘 ==========

function createTray() {
  // 使用内联 16x16 图标（简单网络符号）
  const iconData = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAADfSURBVDiNpZMxDoMwDEWfZmdhYuJMuEJXpu69QjccgRWJgYEjMDJ1Y4BASZzYlJCiI/m/5Cc7gH/WWmutjIjwz2kA4CWl9EJE1uWccxJCOOq6bs45r8uyvOn6vlci6kTEiMgaEfEllFxLYQCYljQNwDQNwHbNIuIxInK3LMvTsixfAIBzLgOo0vV93wfAvO8HyrLM6b2PkYhGSZL8RKQH4AvAe5ZlK13X/QGADwDvAGaAj4iIGRG5Syn9SdKDiNxKKR+6riuIyDudc84lSQKAHaBD13VnSZKkNM/fY8z/8QJ7KmJdFQ5cSwAAAABJRU5ErkJggg==',
    'base64'
  );
  const trayIcon = nativeImage.createFromBuffer(iconData);
  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));

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

  app.whenReady().then(async () => {
    registerIpcHandlers();

    // 先启动后端，再创建窗口
    await startBackend();

    createWindow();
    createTray();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    // 不退出，保持托盘运行
  });

  app.on('before-quit', () => {
    app.isQuitting = true;
    stopBackend();
  });
}
