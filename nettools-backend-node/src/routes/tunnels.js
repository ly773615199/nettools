/**
 * 隧道管理路由 — CRUD + 启停 (含兼容旧路径)
 */
const path = require('path');
const { spawn } = require('child_process');
const { authMiddleware } = require('../core/auth');

const BORE_BIN = path.join(__dirname, '..', '..', '..', 'bin', 'bore');
const runningTunnels = new Map();

function startBoreTunnel(tunnel) {
  const args = ['local', String(parseInt(tunnel.localPort)), '--to', tunnel.remoteServer];
  if (tunnel.remotePort) args.push('--port', String(parseInt(tunnel.remotePort)));
  if (tunnel.secret) args.push('--secret', tunnel.secret);

  const child = spawn(BORE_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'], detached: false });
  child.stdout.on('data', (d) => console.log(`[bore:${tunnel.id}] ${d.toString().trim()}`));
  child.stderr.on('data', (d) => console.error(`[bore:${tunnel.id}] ${d.toString().trim()}`));
  child.on('exit', (code) => {
    console.log(`[bore:${tunnel.id}] exited with code ${code}`);
    runningTunnels.delete(tunnel.id);
  });
  runningTunnels.set(tunnel.id, child);
  return child;
}

function stopBoreTunnel(tunnelId) {
  const child = runningTunnels.get(tunnelId);
  if (child) { child.kill('SIGTERM'); runningTunnels.delete(tunnelId); return true; }
  return false;
}

function registerTunnelRoutes(app, models) {
  const { Tunnel } = models;

  // ---- RESTful 路由 ----

  app.get('/api/tunnels', authMiddleware, async (req, res) => {
    try {
      const tunnels = await Tunnel.findAll({ where: { userId: req.user.id } });
      res.json({ data: tunnels, total: tunnels.length });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/tunnels', authMiddleware, async (req, res) => {
    try {
      const { name, localPort, remoteServer, remotePort } = req.body;
      const tunnel = await Tunnel.create({
        name, localPort, remoteServer, remotePort, status: 'stopped', userId: req.user.id
      });
      res.json({ message: 'Tunnel created successfully', tunnel });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.put('/api/tunnels/:id', authMiddleware, async (req, res) => {
    try {
      const tunnel = await Tunnel.findByPk(req.params.id);
      if (!tunnel) return res.status(404).json({ error: 'Tunnel not found' });
      if (tunnel.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

      const { name, localPort, remoteServer, remotePort } = req.body;
      await tunnel.update({
        name: name || tunnel.name,
        localPort: localPort || tunnel.localPort,
        remoteServer: remoteServer || tunnel.remoteServer,
        remotePort: remotePort || tunnel.remotePort
      });
      res.json({ message: 'Tunnel updated successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete('/api/tunnels/:id', authMiddleware, async (req, res) => {
    try {
      const tunnel = await Tunnel.findByPk(req.params.id);
      if (!tunnel) return res.status(404).json({ error: 'Tunnel not found' });
      if (tunnel.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });
      stopBoreTunnel(tunnel.id);
      await tunnel.destroy();
      res.json({ message: 'Tunnel deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/tunnels/:id/start', authMiddleware, async (req, res) => {
    try {
      const tunnel = await Tunnel.findByPk(req.params.id);
      if (!tunnel) return res.status(404).json({ error: 'Tunnel not found' });
      if (tunnel.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });
      if (runningTunnels.has(tunnel.id)) return res.status(400).json({ error: 'Tunnel is already running' });

      try {
        startBoreTunnel(tunnel);
        await tunnel.update({ status: 'running' });
        res.json({ message: 'Tunnel started successfully' });
      } catch (spawnErr) {
        await tunnel.update({ status: 'error' });
        res.status(500).json({ error: 'Failed to start tunnel process' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/tunnels/:id/stop', authMiddleware, async (req, res) => {
    try {
      const tunnel = await Tunnel.findByPk(req.params.id);
      if (!tunnel) return res.status(404).json({ error: 'Tunnel not found' });
      if (tunnel.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

      stopBoreTunnel(tunnel.id);
      await tunnel.update({ status: 'stopped' });
      res.json({ message: 'Tunnel stopped successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ---- 兼容旧路径 (/api/tunnel/*) ----

  app.get('/api/tunnel/list', authMiddleware, async (req, res) => {
    try {
      const tunnels = await Tunnel.findAll({ where: { userId: req.user.id } });
      res.json({ data: tunnels, total: tunnels.length });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/tunnel/create', authMiddleware, async (req, res) => {
    try {
      const { name, localPort, remoteServer, remotePort } = req.body;
      const tunnel = await Tunnel.create({
        name, localPort, remoteServer, remotePort, status: 'stopped', userId: req.user.id
      });
      res.json({ id: String(tunnel.id), message: 'Tunnel created successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete('/api/tunnel/delete', authMiddleware, async (req, res) => {
    try {
      const tunnel = await Tunnel.findByPk(req.query.id);
      if (!tunnel) return res.status(404).json({ error: 'Not found' });
      if (tunnel.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });
      stopBoreTunnel(tunnel.id);
      await tunnel.destroy();
      res.json({ message: 'Tunnel deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/tunnel/start', authMiddleware, async (req, res) => {
    try {
      const tunnel = await Tunnel.findByPk(req.body.id);
      if (!tunnel) return res.status(404).json({ error: 'Not found' });
      if (tunnel.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });
      if (runningTunnels.has(tunnel.id)) return res.status(400).json({ error: 'Tunnel is already running' });
      try {
        startBoreTunnel(tunnel);
        await tunnel.update({ status: 'running' });
        res.json({ message: 'Tunnel started successfully' });
      } catch {
        await tunnel.update({ status: 'error' });
        res.status(500).json({ error: 'Failed to start tunnel process' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/tunnel/stop', authMiddleware, async (req, res) => {
    try {
      const tunnel = await Tunnel.findByPk(req.body.id);
      if (!tunnel) return res.status(404).json({ error: 'Not found' });
      if (tunnel.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });
      stopBoreTunnel(tunnel.id);
      await tunnel.update({ status: 'stopped' });
      res.json({ message: 'Tunnel stopped successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}

module.exports = { registerTunnelRoutes, startBoreTunnel, stopBoreTunnel, runningTunnels };
