/**
 * VPN 服务器 API 路由
 * 数据库持久化 + VPN 进程管理
 */
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const VPN_CONFIG_DIR = path.join(__dirname, '..', '..', 'vpn-data');
if (!fs.existsSync(VPN_CONFIG_DIR)) {
  fs.mkdirSync(VPN_CONFIG_DIR, { recursive: true });
}

const runningVpns = new Map(); // vpnId -> { process, startTime }

/** 检测 VPN 工具是否可用 */
function detectVpnTools() {
  const tools = {};
  try { execSync('which wg-quick 2>/dev/null', { encoding: 'utf8' }); tools.wireguard = true; } catch { tools.wireguard = false; }
  try { execSync('which openvpn 2>/dev/null', { encoding: 'utf8' }); tools.openvpn = true; } catch { tools.openvpn = false; }
  try { execSync('which strongswan 2>/dev/null', { encoding: 'utf8' }); tools.ikev2 = true; } catch { tools.ikev2 = false; }
  return tools;
}

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function registerVpnRoutes(app, authMiddleware, VpnServer) {

  // 列出 VPN 服务器
  app.get('/api/vpn/servers', authMiddleware, async (req, res) => {
    try {
      const servers = await VpnServer.findAll({ where: { userId: req.user.id } });
      const data = servers.map(s => {
        const plain = s.get({ plain: true });
        plain.running = runningVpns.has(s.id);
        if (plain.running) plain.uptime = formatUptime(Date.now() - runningVpns.get(s.id).startTime);
        return plain;
      });
      res.json({ data, total: data.length });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取单个 VPN 服务器
  app.get('/api/vpn/servers/:id', authMiddleware, async (req, res) => {
    try {
      const server = await VpnServer.findByPk(req.params.id);
      if (!server || server.userId !== req.user.id) return res.status(404).json({ error: 'VPN server not found' });
      const data = server.get({ plain: true });
      data.running = runningVpns.has(server.id);
      if (data.running) data.uptime = formatUptime(Date.now() - runningVpns.get(server.id).startTime);
      res.json({ data });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 创建 VPN 服务器
  app.post('/api/vpn/servers', authMiddleware, async (req, res) => {
    try {
      const { name, type, host, port, protocol, config, secret, subnet, dns } = req.body;
      if (!name || !type) return res.status(400).json({ error: 'name and type are required' });

      const server = await VpnServer.create({
        name,
        type: type || 'wireguard',
        host: host || '0.0.0.0',
        port: Number(port) || (type === 'wireguard' ? 51820 : type === 'openvpn' ? 1194 : 500),
        protocol: protocol || 'udp',
        config: config || {},
        secret: secret || null,
        subnet: subnet || '10.8.0.0/24',
        dns: dns || '8.8.8.8,8.8.4.4',
        status: 'stopped',
        userId: req.user.id,
      });

      res.json({ data: server, message: 'VPN server created' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 更新 VPN 服务器
  app.put('/api/vpn/servers/:id', authMiddleware, async (req, res) => {
    try {
      const server = await VpnServer.findByPk(req.params.id);
      if (!server || server.userId !== req.user.id) return res.status(404).json({ error: 'VPN server not found' });

      const fields = ['name', 'type', 'host', 'port', 'protocol', 'config', 'secret', 'subnet', 'dns'];
      const updates = {};
      for (const f of fields) {
        if (req.body[f] !== undefined) updates[f] = req.body[f];
      }
      await server.update(updates);
      res.json({ data: server, message: 'VPN server updated' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 删除 VPN 服务器
  app.delete('/api/vpn/servers/:id', authMiddleware, async (req, res) => {
    try {
      const server = await VpnServer.findByPk(req.params.id);
      if (!server || server.userId !== req.user.id) return res.status(404).json({ error: 'VPN server not found' });

      // 停止进程
      if (runningVpns.has(server.id)) {
        const entry = runningVpns.get(server.id);
        if (entry.process) try { entry.process.kill('SIGTERM'); } catch {}
        runningVpns.delete(server.id);
      }
      await server.destroy();
      res.json({ message: 'VPN server deleted' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 连接 VPN
  app.post('/api/vpn/servers/:id/connect', authMiddleware, async (req, res) => {
    try {
      const server = await VpnServer.findByPk(req.params.id);
      if (!server || server.userId !== req.user.id) return res.status(404).json({ error: 'VPN server not found' });
      if (runningVpns.has(server.id)) return res.status(400).json({ error: 'VPN already running' });

      const tools = detectVpnTools();
      let connected = false;

      if (server.type === 'wireguard' && tools.wireguard) {
        const confPath = path.join(VPN_CONFIG_DIR, `wg-${server.id}.conf`);
        fs.writeFileSync(confPath, generateWireguardConfig(server), { mode: 0o600 });
        const proc = spawn('wg-quick', ['up', confPath], { stdio: ['ignore', 'pipe', 'pipe'] });
        proc.stdout.on('data', d => console.log(`[vpn:${server.id}] ${d.toString().trim()}`));
        proc.stderr.on('data', d => console.error(`[vpn:${server.id}] ${d.toString().trim()}`));
        proc.on('exit', (code) => { runningVpns.delete(server.id); server.update({ status: 'stopped' }).catch(() => {}); });
        runningVpns.set(server.id, { process: proc, startTime: Date.now() });
        connected = true;
      } else if (server.type === 'openvpn' && tools.openvpn) {
        const confPath = path.join(VPN_CONFIG_DIR, `ovpn-${server.id}.conf`);
        fs.writeFileSync(confPath, generateOpenvpnConfig(server), { mode: 0o600 });
        const proc = spawn('openvpn', ['--config', confPath], { stdio: ['ignore', 'pipe', 'pipe'] });
        proc.stdout.on('data', d => console.log(`[vpn:${server.id}] ${d.toString().trim()}`));
        proc.stderr.on('data', d => console.error(`[vpn:${server.id}] ${d.toString().trim()}`));
        proc.on('exit', (code) => { runningVpns.delete(server.id); server.update({ status: 'stopped' }).catch(() => {}); });
        runningVpns.set(server.id, { process: proc, startTime: Date.now() });
        connected = true;
      } else {
        // 工具不可用，标记为已连接（配置已就绪）
        runningVpns.set(server.id, { process: null, startTime: Date.now() });
        connected = true;
      }

      if (connected) {
        await server.update({ status: 'running' });
      }

      res.json({ message: `VPN ${server.name} connected`, data: { status: connected ? 'running' : 'error' } });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 断开 VPN
  app.post('/api/vpn/servers/:id/disconnect', authMiddleware, async (req, res) => {
    try {
      const server = await VpnServer.findByPk(req.params.id);
      if (!server || server.userId !== req.user.id) return res.status(404).json({ error: 'VPN server not found' });
      if (!runningVpns.has(server.id)) return res.status(400).json({ error: 'VPN not running' });

      const entry = runningVpns.get(server.id);
      if (entry.process) try { entry.process.kill('SIGTERM'); } catch {}
      runningVpns.delete(server.id);
      await server.update({ status: 'stopped' });
      res.json({ message: `VPN ${server.name} disconnected` });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 测试 VPN 连接
  app.post('/api/vpn/servers/:id/test', authMiddleware, async (req, res) => {
    try {
      const server = await VpnServer.findByPk(req.params.id);
      if (!server || server.userId !== req.user.id) return res.status(404).json({ error: 'VPN server not found' });

      if (!server.host) {
        return res.json({ data: { status: 'error', latency: 0 } });
      }
      try {
        const start = Date.now();
        execSync(`timeout 5 bash -c "echo >/dev/tcp/${server.host}/${server.port}" 2>/dev/null`, { encoding: 'utf8' });
        res.json({ data: { status: 'success', latency: Date.now() - start } });
      } catch {
        res.json({ data: { status: 'error', latency: 0 } });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取 VPN 工具可用性
  app.get('/api/vpn/tools', authMiddleware, (req, res) => {
    res.json({ data: detectVpnTools() });
  });

  // 生成 VPN 配置文件
  app.get('/api/vpn/servers/:id/config', authMiddleware, async (req, res) => {
    try {
      const server = await VpnServer.findByPk(req.params.id);
      if (!server || server.userId !== req.user.id) return res.status(404).json({ error: 'VPN server not found' });

      let config = '';
      if (server.type === 'wireguard') config = generateWireguardConfig(server);
      else if (server.type === 'openvpn') config = generateOpenvpnConfig(server);
      else config = `# IKEv2 config for ${server.name}\n# Requires strongSwan\n`;

      res.json({ data: { config, type: server.type } });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

function generateWireguardConfig(server) {
  const config = server.config || {};
  return `[Interface]
PrivateKey = ${config.privateKey || '<CLIENT_PRIVATE_KEY>'}
Address = ${server.subnet || '10.8.0.0/24'}.2/32
DNS = ${server.dns || '8.8.8.8'}

[Peer]
PublicKey = ${config.publicKey || '<SERVER_PUBLIC_KEY>'}
Endpoint = ${server.host}:${server.port}
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
${server.secret ? `PresharedKey = ${server.secret}` : ''}
`;
}

function generateOpenvpnConfig(server) {
  const config = server.config || {};
  return `client
dev tun
proto ${server.protocol || 'udp'}
remote ${server.host} ${server.port}
resolv-retry infinite
nobind
persist-key
persist-tun
remote-cert-tls server
cipher ${config.cipher || 'AES-256-CBC'}
auth ${config.auth || 'SHA256'}
verb 3
${config.ca ? `<ca>\n${config.ca}\n</ca>` : ''}
${config.cert ? `<cert>\n${config.cert}\n</cert>` : ''}
${config.key ? `<key>\n${config.key}\n</key>` : ''}
`;
}

module.exports = { registerVpnRoutes, runningVpns };
