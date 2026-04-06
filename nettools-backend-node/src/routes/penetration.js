/**
 * 统一穿透管理 API 路由
 * 节点 CRUD + 实例 CRUD + 生命周期 + 部署 + 配置导出
 */
const { penetrationManager } = require('../services/penetration');

function registerPenetrationRoutes(app, authMiddleware, models) {
  const { PenetrationNode, PenetrationInstance } = models;

  // ============================================
  //  工具端点
  // ============================================

  // 获取支持的穿透类型
  app.get('/api/penetration/types', authMiddleware, (req, res) => {
    res.json({ data: penetrationManager.getSupportedTypes() });
  });

  // 检测本机能力
  app.get('/api/penetration/tools/detect-local', authMiddleware, async (req, res) => {
    try {
      const capabilities = await penetrationManager.detectLocalCapabilities();
      res.json({ data: capabilities });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 生成密钥对
  app.post('/api/penetration/tools/generate-keys', authMiddleware, (req, res) => {
    try {
      const { type } = req.body;
      const keys = penetrationManager.generateKeys(type || 'wireguard');
      res.json({ data: keys });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================
  //  节点管理
  // ============================================

  // 列出所有节点
  app.get('/api/penetration/nodes', authMiddleware, async (req, res) => {
    try {
      const nodes = await PenetrationNode.findAll({ where: { userId: req.user.id } });
      res.json({ data: nodes, total: nodes.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 获取单个节点
  app.get('/api/penetration/nodes/:id', authMiddleware, async (req, res) => {
    try {
      const node = await PenetrationNode.findByPk(req.params.id);
      if (!node || node.userId !== req.user.id) return res.status(404).json({ error: 'Node not found' });
      res.json({ data: node });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 创建节点
  app.post('/api/penetration/nodes', authMiddleware, async (req, res) => {
    try {
      const { name, nodeType, host, sshPort, sshUser, sshAuth, sshKeyPath, sshPassword } = req.body;
      if (!name) return res.status(400).json({ error: 'name is required' });

      const node = await PenetrationNode.create({
        name,
        nodeType: nodeType || 'vps',
        host: host || 'localhost',
        sshPort: sshPort || 22,
        sshUser: sshUser || 'root',
        sshAuth: sshAuth || 'key',
        sshKeyPath: sshKeyPath || null,
        sshPassword: sshPassword || null,
        userId: req.user.id,
      });

      res.json({ data: node, message: 'Node created' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 更新节点
  app.put('/api/penetration/nodes/:id', authMiddleware, async (req, res) => {
    try {
      const node = await PenetrationNode.findByPk(req.params.id);
      if (!node || node.userId !== req.user.id) return res.status(404).json({ error: 'Node not found' });

      const fields = ['name', 'nodeType', 'host', 'sshPort', 'sshUser', 'sshAuth', 'sshKeyPath', 'sshPassword'];
      const updates = {};
      for (const f of fields) {
        if (req.body[f] !== undefined) updates[f] = req.body[f];
      }
      await node.update(updates);
      res.json({ data: node, message: 'Node updated' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 删除节点
  app.delete('/api/penetration/nodes/:id', authMiddleware, async (req, res) => {
    try {
      const node = await PenetrationNode.findByPk(req.params.id);
      if (!node || node.userId !== req.user.id) return res.status(404).json({ error: 'Node not found' });
      await node.destroy();
      res.json({ message: 'Node deleted' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 自动检测节点信息
  app.post('/api/penetration/nodes/:id/detect', authMiddleware, async (req, res) => {
    try {
      const node = await PenetrationNode.findByPk(req.params.id);
      if (!node || node.userId !== req.user.id) return res.status(404).json({ error: 'Node not found' });

      const info = await penetrationManager.detectNode(node.get({ plain: true }));
      await node.update({
        osType: info.osType,
        arch: info.arch,
        hasRoot: info.hasRoot,
        hasDocker: info.hasDocker,
        publicIp: info.publicIp,
        pkgManager: info.pkgManager,
        installed: info.installed,
        status: 'reachable',
        lastSeenAt: new Date(),
      });

      res.json({ data: info, message: 'Node detected' });
    } catch (err) {
      await PenetrationNode.update({ status: 'unreachable' }, { where: { id: req.params.id } });
      res.status(500).json({ error: err.message });
    }
  });

  // 测试节点连通性
  app.post('/api/penetration/nodes/:id/test', authMiddleware, async (req, res) => {
    try {
      const node = await PenetrationNode.findByPk(req.params.id);
      if (!node || node.userId !== req.user.id) return res.status(404).json({ error: 'Node not found' });

      const result = await penetrationManager.testNode(node.get({ plain: true }));
      res.json({ data: result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 部署组件到节点
  app.post('/api/penetration/nodes/:id/deploy', authMiddleware, async (req, res) => {
    try {
      const node = await PenetrationNode.findByPk(req.params.id);
      if (!node || node.userId !== req.user.id) return res.status(404).json({ error: 'Node not found' });

      const { components, config } = req.body;
      if (!components || !components.length) {
        return res.status(400).json({ error: 'components array is required' });
      }

      const nodeInfo = await penetrationManager.detectNode(node.get({ plain: true }));
      const fakeInstance = { config: config || {}, mappings: [], type: components[0] };

      const result = await penetrationManager.deployToNode(
        node.get({ plain: true }),
        components,
        fakeInstance,
        nodeInfo
      );

      // 更新已安装组件
      const installed = node.installed || {};
      for (const c of components) installed[c] = true;
      await node.update({ installed });

      res.json({ data: result, message: 'Deployment complete' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 获取节点状态
  app.get('/api/penetration/nodes/:id/status', authMiddleware, async (req, res) => {
    try {
      const node = await PenetrationNode.findByPk(req.params.id);
      if (!node || node.userId !== req.user.id) return res.status(404).json({ error: 'Node not found' });

      // 统计运行中的实例数
      const runningInstances = await PenetrationInstance.count({
        where: {
          userId: req.user.id,
          status: 'running',
          [require('sequelize').Op.or]: [
            { serverNodeId: node.id },
            { clientNodeId: node.id },
          ],
        },
      });

      res.json({
        data: {
          status: node.status,
          installed: node.installed,
          runningInstances,
          lastSeenAt: node.lastSeenAt,
        },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================
  //  穿透实例管理
  // ============================================

  // 列出所有实例
  app.get('/api/penetration/instances', authMiddleware, async (req, res) => {
    try {
      const instances = await PenetrationInstance.findAll({
        where: { userId: req.user.id },
      });

      const data = instances.map(i => {
        const plain = i.get({ plain: true });
        const status = penetrationManager.getStatus(i.id);
        plain.running = status.running;
        if (status.running) {
          plain.uptime = status.uptime;
          plain.bytesUp = status.bytesUp || 0;
          plain.bytesDown = status.bytesDown || 0;
        }
        return plain;
      });

      res.json({ data, total: data.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 获取单个实例
  app.get('/api/penetration/instances/:id', authMiddleware, async (req, res) => {
    try {
      const instance = await PenetrationInstance.findByPk(req.params.id);
      if (!instance || instance.userId !== req.user.id) {
        return res.status(404).json({ error: 'Instance not found' });
      }

      const plain = instance.get({ plain: true });
      const status = penetrationManager.getStatus(instance.id);
      plain.running = status.running;
      plain.liveStatus = status;

      res.json({ data: plain });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 创建实例
  app.post('/api/penetration/instances', authMiddleware, async (req, res) => {
    try {
      const { name, type, serverNodeId, clientNodeId, role, mappings, config } = req.body;
      if (!name || !type) return res.status(400).json({ error: 'name and type are required' });

      const instance = await PenetrationInstance.create({
        name,
        type,
        serverNodeId: serverNodeId || null,
        clientNodeId: clientNodeId || null,
        role: role || 'client',
        mappings: mappings || [],
        config: config || {},
        status: 'created',
        userId: req.user.id,
      });

      res.json({ data: instance, message: 'Instance created' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 更新实例
  app.put('/api/penetration/instances/:id', authMiddleware, async (req, res) => {
    try {
      const instance = await PenetrationInstance.findByPk(req.params.id);
      if (!instance || instance.userId !== req.user.id) {
        return res.status(404).json({ error: 'Instance not found' });
      }

      const fields = ['name', 'serverNodeId', 'clientNodeId', 'role', 'mappings', 'config'];
      const updates = {};
      for (const f of fields) {
        if (req.body[f] !== undefined) updates[f] = req.body[f];
      }
      await instance.update(updates);
      res.json({ data: instance, message: 'Instance updated' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 删除实例
  app.delete('/api/penetration/instances/:id', authMiddleware, async (req, res) => {
    try {
      const instance = await PenetrationInstance.findByPk(req.params.id);
      if (!instance || instance.userId !== req.user.id) {
        return res.status(404).json({ error: 'Instance not found' });
      }
      await penetrationManager.stop(instance);
      await instance.destroy();
      res.json({ message: 'Instance deleted' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 启动实例
  app.post('/api/penetration/instances/:id/start', authMiddleware, async (req, res) => {
    try {
      const instance = await PenetrationInstance.findByPk(req.params.id);
      if (!instance || instance.userId !== req.user.id) {
        return res.status(404).json({ error: 'Instance not found' });
      }
      const result = await penetrationManager.start(instance);
      if (!result.success) return res.status(400).json({ error: result.error });
      res.json({ message: 'Instance started', data: result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 停止实例
  app.post('/api/penetration/instances/:id/stop', authMiddleware, async (req, res) => {
    try {
      const instance = await PenetrationInstance.findByPk(req.params.id);
      if (!instance || instance.userId !== req.user.id) {
        return res.status(404).json({ error: 'Instance not found' });
      }
      const result = await penetrationManager.stop(instance);
      res.json({ message: 'Instance stopped' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 重启实例
  app.post('/api/penetration/instances/:id/restart', authMiddleware, async (req, res) => {
    try {
      const instance = await PenetrationInstance.findByPk(req.params.id);
      if (!instance || instance.userId !== req.user.id) {
        return res.status(404).json({ error: 'Instance not found' });
      }
      const result = await penetrationManager.restart(instance);
      if (!result.success) return res.status(400).json({ error: result.error });
      res.json({ message: 'Instance restarted', data: result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 获取实例状态
  app.get('/api/penetration/instances/:id/status', authMiddleware, async (req, res) => {
    try {
      const instance = await PenetrationInstance.findByPk(req.params.id);
      if (!instance || instance.userId !== req.user.id) {
        return res.status(404).json({ error: 'Instance not found' });
      }
      const status = penetrationManager.getStatus(instance.id);
      res.json({ data: status });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 导出客户端配置
  app.get('/api/penetration/instances/:id/export', authMiddleware, async (req, res) => {
    try {
      const instance = await PenetrationInstance.findByPk(req.params.id);
      if (!instance || instance.userId !== req.user.id) {
        return res.status(404).json({ error: 'Instance not found' });
      }
      const config = penetrationManager.exportClientConfig(instance.get({ plain: true }));
      res.json({ data: config });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 一键部署实例服务端到目标节点
  app.post('/api/penetration/instances/:id/deploy', authMiddleware, async (req, res) => {
    try {
      const instance = await PenetrationInstance.findByPk(req.params.id);
      if (!instance || instance.userId !== req.user.id) {
        return res.status(404).json({ error: 'Instance not found' });
      }

      const serverNodeId = instance.serverNodeId;
      if (!serverNodeId) return res.status(400).json({ error: 'Instance has no server node' });

      const node = await PenetrationNode.findByPk(serverNodeId);
      if (!node) return res.status(404).json({ error: 'Server node not found' });

      const nodeInfo = await penetrationManager.detectNode(node.get({ plain: true }));
      const result = await penetrationManager.deployToNode(
        node.get({ plain: true }),
        [instance.type],
        instance.get({ plain: true }),
        nodeInfo
      );

      res.json({ data: result, message: 'Deployment complete' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

module.exports = { registerPenetrationRoutes };
