/**
 * Phase 3 穿透引擎 - 集成测试脚本
 * 运行: node test/integration.test.js
 *
 * 验证项:
 * 1. 后端启动 + 模型同步
 * 2. 本地节点自动注册
 * 3. PenetrationManager 核心功能
 * 4. 各驱动 detect/config 生成
 * 5. API 路由连通性
 */

const http = require('http');
const assert = require('assert');

const BASE_URL = process.env.TEST_URL || 'http://localhost:8000';
let authToken = '';

// 测试工具
async function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  return fn()
    .then(() => {
      console.log(`  ✅ ${name}`);
      passed++;
    })
    .catch((err) => {
      console.log(`  ❌ ${name}: ${err.message}`);
      failed++;
    });
}

async function run() {
  console.log('\n🔧 Phase 3 穿透引擎 - 集成测试\n');
  console.log(`📍 目标: ${BASE_URL}\n`);

  // 1. 健康检查
  console.log('1️⃣  后端连通性');
  await test('GET /health', async () => {
    const res = await request('GET', '/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'ok');
  });

  // 2. 认证
  console.log('\n2️⃣  认证');
  await test('POST /api/auth/login', async () => {
    const res = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'password',
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.token, 'Should return token');
    authToken = res.data.token;
  });

  // 3. 穿透类型
  console.log('\n3️⃣  穿透类型列表');
  await test('GET /api/penetration/types', async () => {
    const res = await request('GET', '/api/penetration/types');
    assert.strictEqual(res.status, 200);
    const types = res.data.data;
    assert.ok(Array.isArray(types), 'Should return array');
    assert.ok(types.length >= 5, 'Should have 5 penetration types');
    const typeNames = types.map((t) => t.type);
    assert.ok(typeNames.includes('wireguard'));
    assert.ok(typeNames.includes('bore'));
    assert.ok(typeNames.includes('frp'));
    assert.ok(typeNames.includes('ssh'));
    assert.ok(typeNames.includes('cloudflare'));
  });

  // 4. 本地节点自动注册
  console.log('\n4️⃣  本地节点');
  await test('GET /api/penetration/nodes (should have local node)', async () => {
    const res = await request('GET', '/api/penetration/nodes');
    assert.strictEqual(res.status, 200);
    const nodes = res.data.data;
    assert.ok(Array.isArray(nodes));
    const localNode = nodes.find((n) => n.nodeType === 'local');
    assert.ok(localNode, 'Local node should be auto-registered');
    assert.strictEqual(localNode.name, '本机');
    assert.strictEqual(localNode.status, 'reachable');
  });

  // 5. 密钥生成
  console.log('\n5️⃣  密钥生成');
  await test('POST /api/penetration/tools/generate-keys (wireguard)', async () => {
    const res = await request('POST', '/api/penetration/tools/generate-keys', {
      type: 'wireguard',
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.data.privateKey);
    assert.ok(res.data.data.publicKey);
  });

  await test('POST /api/penetration/tools/generate-keys (frp)', async () => {
    const res = await request('POST', '/api/penetration/tools/generate-keys', {
      type: 'frp',
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.data.token);
  });

  // 6. 创建穿透节点
  console.log('\n6️⃣  节点 CRUD');
  let testNodeId;
  await test('POST /api/penetration/nodes (create VPS node)', async () => {
    const res = await request('POST', '/api/penetration/nodes', {
      name: '测试VPS',
      nodeType: 'vps',
      host: '192.168.1.100',
      sshPort: 22,
      sshUser: 'root',
      sshAuth: 'key',
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.data.id);
    testNodeId = res.data.data.id;
  });

  await test('GET /api/penetration/nodes/:id', async () => {
    const res = await request('GET', `/api/penetration/nodes/${testNodeId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.name, '测试VPS');
  });

  await test('PUT /api/penetration/nodes/:id', async () => {
    const res = await request('PUT', `/api/penetration/nodes/${testNodeId}`, {
      name: '测试VPS-已更新',
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.name, '测试VPS-已更新');
  });

  // 7. 创建穿透实例
  console.log('\n7️⃣  实例 CRUD');
  let testInstanceId;
  await test('POST /api/penetration/instances (create bore instance)', async () => {
    const res = await request('POST', '/api/penetration/instances', {
      name: '测试Bore穿透',
      type: 'bore',
      serverNodeId: testNodeId,
      role: 'client',
      mappings: [{ localPort: 3000, remotePort: 8080, protocol: 'tcp' }],
      config: { serverHost: '192.168.1.100', secret: 'test-secret' },
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.data.id);
    testInstanceId = res.data.data.id;
    assert.strictEqual(res.data.data.status, 'created');
  });

  await test('GET /api/penetration/instances/:id', async () => {
    const res = await request('GET', `/api/penetration/instances/${testInstanceId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.name, '测试Bore穿透');
    assert.deepStrictEqual(res.data.data.mappings, [
      { localPort: 3000, remotePort: 8080, protocol: 'tcp' },
    ]);
  });

  // 8. 配置导出
  console.log('\n8️⃣  配置导出');
  await test('GET /api/penetration/instances/:id/export', async () => {
    const res = await request('GET', `/api/penetration/instances/${testInstanceId}/export`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.data.content);
    assert.ok(res.data.data.filename);
  });

  // 9. 实例状态
  console.log('\n9️⃣  实例状态');
  await test('GET /api/penetration/instances/:id/status', async () => {
    const res = await request('GET', `/api/penetration/instances/${testInstanceId}/status`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.running, false);
  });

  // 10. Clash TUN API
  console.log('\n🔟  Clash TUN API');
  await test('GET /api/clash/tun', async () => {
    const res = await request('GET', '/api/clash/tun');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.enabled, false);
  });

  await test('PUT /api/clash/tun (enable)', async () => {
    const res = await request('PUT', '/api/clash/tun', {
      enable: true,
      stack: 'mixed',
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.tunEnabled, true);
  });

  await test('PUT /api/clash/tun (disable)', async () => {
    const res = await request('PUT', '/api/clash/tun', { enable: false });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.tunEnabled, false);
  });

  // 清理
  console.log('\n🧹 清理测试数据');
  await test('DELETE /api/penetration/instances/:id', async () => {
    const res = await request('DELETE', `/api/penetration/instances/${testInstanceId}`);
    assert.strictEqual(res.status, 200);
  });

  await test('DELETE /api/penetration/nodes/:id', async () => {
    const res = await request('DELETE', `/api/penetration/nodes/${testNodeId}`);
    assert.strictEqual(res.status, 200);
  });

  // 结果
  console.log('\n' + '='.repeat(50));
  console.log(`\n📊 测试结果: ${passed} passed, ${failed} failed\n`);

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
