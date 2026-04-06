/**
 * Bore 隧道服务器管理器
 * 管理 bore server 进程的生命周期
 */
const { spawn } = require('child_process');
const path = require('path');

const BORE_BIN = path.join(__dirname, '..', '..', '..', 'bin', 'bore');
const runningServers = new Map(); // serverId -> child_process

/**
 * 启动 bore server
 * @param {Object} server - TunnelServer 模型实例
 * @returns {{ success: boolean, message?: string, error?: string }}
 */
function startServer(server) {
  if (runningServers.has(server.id)) {
    return { success: false, error: 'Server is already running' };
  }

  const args = ['server'];
  args.push('--min-port', String(parseInt(server.minPort) || 1024));
  args.push('--max-port', String(parseInt(server.maxPort) || 65535));
  if (server.secret) {
    args.push('--secret', server.secret);
  }
  args.push('--bind-addr', server.host || '0.0.0.0');
  // 控制端口通过环境变量或默认
  // bore server 默认监听 7835

  try {
    const child = spawn(BORE_BIN, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
      env: { ...process.env },
    });

    child.stdout.on('data', (data) => {
      console.log(`[bore-server:${server.id}] ${data.toString().trim()}`);
    });
    child.stderr.on('data', (data) => {
      console.error(`[bore-server:${server.id}] ${data.toString().trim()}`);
    });
    child.on('exit', (code) => {
      console.log(`[bore-server:${server.id}] exited with code ${code}`);
      runningServers.delete(server.id);
    });

    runningServers.set(server.id, child);
    return { success: true, message: 'Bore server started' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * 停止 bore server
 * @param {number|string} serverId
 * @returns {{ success: boolean, message?: string, error?: string }}
 */
function stopServer(serverId) {
  const child = runningServers.get(Number(serverId));
  if (!child) {
    return { success: false, error: 'Server is not running' };
  }
  child.kill('SIGTERM');
  runningServers.delete(Number(serverId));
  return { success: true, message: 'Bore server stopped' };
}

/**
 * 获取服务器运行状态
 * @param {number|string} serverId
 * @returns {{ running: boolean }}
 */
function getServerStatus(serverId) {
  return { running: runningServers.has(Number(serverId)) };
}

/**
 * 获取所有运行中的服务器
 * @returns {Array<{id: number}>}
 */
function listRunning() {
  return Array.from(runningServers.keys()).map(id => ({ id }));
}

/**
 * 停止所有服务器（优雅关闭时调用）
 */
function stopAll() {
  for (const [id, child] of runningServers) {
    try { child.kill('SIGTERM'); } catch {}
  }
  runningServers.clear();
}

module.exports = {
  startServer,
  stopServer,
  getServerStatus,
  listRunning,
  stopAll,
  runningServers,
};
