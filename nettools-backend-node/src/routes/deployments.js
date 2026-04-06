/**
 * 服务器部署 API 路由
 * 支持部署配置管理和基本连通性测试
 */

let deployments = [];
let nextId = 1;

function registerDeploymentRoutes(app, authMiddleware) {

  // 获取部署列表
  app.get('/api/deployments', authMiddleware, (req, res) => {
    const data = deployments.filter(d => d.userId === req.user.id);
    res.json({ data, total: data.length });
  });

  // 获取单个部署
  app.get('/api/deployments/:id', authMiddleware, (req, res) => {
    const d = deployments.find(x => x.id === Number(req.params.id) && x.userId === req.user.id);
    if (!d) return res.status(404).json({ error: 'Deployment not found' });
    res.json({ data: d });
  });

  // 创建部署
  app.post('/api/deployments', authMiddleware, (req, res) => {
    const { name, type, provider, region, instanceType, sshKey, domain, port, authToken } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'name and type are required' });

    const d = {
      id: nextId++,
      name,
      type: type || 'tunnel',
      provider: provider || 'custom',
      region: region || '',
      instanceType: instanceType || '',
      sshKey: sshKey || '',
      domain: domain || '',
      port: Number(port) || 22,
      authToken: authToken || '',
      status: 'stopped',
      ipAddress: '',
      userId: req.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    deployments.push(d);
    res.json({ data: d, message: 'Deployment created' });
  });

  // 更新部署
  app.put('/api/deployments/:id', authMiddleware, (req, res) => {
    const idx = deployments.findIndex(x => x.id === Number(req.params.id) && x.userId === req.user.id);
    if (idx === -1) return res.status(404).json({ error: 'Deployment not found' });

    const fields = ['name', 'type', 'provider', 'region', 'instanceType', 'sshKey', 'domain', 'port', 'authToken', 'ipAddress', 'status'];
    for (const f of fields) {
      if (req.body[f] !== undefined) deployments[idx][f] = req.body[f];
    }
    deployments[idx].updatedAt = new Date().toISOString();
    res.json({ data: deployments[idx], message: 'Deployment updated' });
  });

  // 删除部署
  app.delete('/api/deployments/:id', authMiddleware, (req, res) => {
    const id = Number(req.params.id);
    const idx = deployments.findIndex(x => x.id === id && x.userId === req.user.id);
    if (idx === -1) return res.status(404).json({ error: 'Deployment not found' });
    deployments.splice(idx, 1);
    res.json({ message: 'Deployment deleted' });
  });

  // 启动部署
  app.post('/api/deployments/:id/start', authMiddleware, (req, res) => {
    const d = deployments.find(x => x.id === Number(req.params.id) && x.userId === req.user.id);
    if (!d) return res.status(404).json({ error: 'Deployment not found' });
    d.status = 'running';
    d.updatedAt = new Date().toISOString();
    res.json({ message: `Deployment ${d.name} started` });
  });

  // 停止部署
  app.post('/api/deployments/:id/stop', authMiddleware, (req, res) => {
    const d = deployments.find(x => x.id === Number(req.params.id) && x.userId === req.user.id);
    if (!d) return res.status(404).json({ error: 'Deployment not found' });
    d.status = 'stopped';
    d.updatedAt = new Date().toISOString();
    res.json({ message: `Deployment ${d.name} stopped` });
  });

  // 测试服务器连接
  app.post('/api/deployments/:id/test', authMiddleware, (req, res) => {
    const d = deployments.find(x => x.id === Number(req.params.id) && x.userId === req.user.id);
    if (!d) return res.status(404).json({ error: 'Deployment not found' });
    if (!d.ipAddress && !d.domain) {
      return res.json({ data: { status: 'error', latency: 0 } });
    }
    const host = d.ipAddress || d.domain;
    try {
      const { execSync } = require('child_process');
      const start = Date.now();
      execSync(`timeout 5 bash -c "echo >/dev/tcp/${host}/${d.port}" 2>/dev/null`, { encoding: 'utf8' });
      res.json({ data: { status: 'success', latency: Date.now() - start } });
    } catch {
      res.json({ data: { status: 'error', latency: 0 } });
    }
  });

  // 获取可用云服务提供商
  app.get('/api/deployments/providers', authMiddleware, (req, res) => {
    res.json({
      data: [
        { name: 'aws', regions: ['us-east-1', 'us-west-1', 'eu-west-1', 'ap-southeast-1', 'ap-northeast-1'] },
        { name: 'gcp', regions: ['us-central1', 'us-east1', 'europe-west1', 'asia-east1', 'asia-southeast1'] },
        { name: 'azure', regions: ['eastus', 'westus', 'northeurope', 'southeastasia', 'eastasia'] },
        { name: 'digitalocean', regions: ['nyc1', 'sfo1', 'lon1', 'fra1', 'sgp1'] },
        { name: 'vultr', regions: ['ewr', 'lax', 'lhr', 'fra', 'sgp'] },
      ]
    });
  });

  // 获取可用实例类型
  app.get('/api/deployments/instance-types/:provider', authMiddleware, (req, res) => {
    const types = {
      aws: ['t2.micro', 't2.small', 't2.medium', 't3.micro', 't3.small'],
      gcp: ['e2-micro', 'e2-small', 'e2-medium', 'g1-small', 'n1-standard-1'],
      azure: ['B1s', 'B1ms', 'B2s', 'B2ms', 'D2s_v3'],
      digitalocean: ['s-1vcpu-1gb', 's-1vcpu-2gb', 's-2vcpu-2gb', 's-2vcpu-4gb', 's-4vcpu-8gb'],
      vultr: ['vc2-1c-1gb', 'vc2-1c-2gb', 'vc2-2c-4gb', 'vc2-4c-8gb', 'vc2-8c-16gb'],
    };
    res.json({ data: types[req.params.provider] || [] });
  });
}

module.exports = { registerDeploymentRoutes };
