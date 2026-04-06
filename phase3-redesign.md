# Phase 3 重设计：统一穿透引擎

> 版本: 3.1 | 日期: 2026-04-06
> 核心思路: **VPN/TUN 为底座 + 多协议穿透 + 多节点一键部署 (VPS/NAS/本地电脑)**

---

## 一、设计目标

### 用户想要的效果

```
┌──────────────┐         公网/互联网          ┌──────────────────┐
│  本地设备      │  ◄──── 穿透隧道 ────►  │  公网服务器         │
│  (内网/NAT后)  │                          │  (VPS/云主机)      │
│              │                          │                  │
│  本地服务:     │   WireGuard / Bore /     │  暴露端口:          │
│  - Web :3000 │   FRP / SSH / TUN ...    │  - :80  → :3000  │
│  - DB  :5432 │   ──────────────────►    │  - :5432 → :5432 │
│  - SSH :22   │   任选一种或多种方式       │  - :22  → :22    │
└──────────────┘                          └──────────────────┘
```

### 用户真正的拓扑

```
                         ┌─────────────────────────┐
                         │    公网/互联网            │
                         └──────┬──────┬──────┬────┘
                                │      │      │
              ┌─────────────────┘      │      └─────────────────┐
              ▼                        ▼                        ▼
    ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
    │  ☁️ 云服务器/VPS    │    │  📦 NAS (群晖等)   │    │  💻 本地电脑        │
    │  公网IP ✅         │    │  内网IP (可能有公网) │    │  内网IP            │
    │                  │    │                  │    │                  │
    │  角色: 穿透中继站   │    │  角色: 服务端/客户端 │    │  角色: 客户端       │
    │  部署:            │    │  部署:            │    │  部署:            │
    │  - WireGuard 服务端│    │  - WireGuard 节点  │    │  - WireGuard 客户端│
    │  - FRP 服务端      │    │  - FRP 服务端/客户端│    │  - FRP 客户端      │
    │  - Bore 服务端     │    │  - Bore 服务端     │    │  - Bore 客户端     │
    │  - Clash 代理      │    │  - 暴露NAS服务     │    │  - 暴露本地服务     │
    └──────────────────┘    └──────────────────┘    └──────────────────┘
              │                        │                        │
              │     WireGuard / FRP / Bore / SSH 隧道          │
              └────────────────────────────────────────────────┘
```

### 关键需求

1. **VPN 能力为核心**：TUN 模式创建虚拟网卡，把整个内网路由到公网服务器
2. **全穿透方法覆盖**：不是只能用一种，而是 WireGuard / Bore / FRP / SSH 反向隧道 / Cloudflare Tunnel 都支持
3. **多节点一键部署**：VPS、NAS、本地电脑均可作为穿透节点，自动检测目标系统类型
4. **前端统一管理**：一个页面管理所有穿透节点和实例，不分散在多个页面

---

## 二、穿透方法对比与选型

| 方法 | 原理 | 需要公网服务器 | 需要 root | 部署难度 | 适用场景 | 状态 |
|------|------|:---:|:---:|------|------|:---:|
| **WireGuard VPN** | TUN 虚拟网卡 + 加密隧道 | ✅ | ✅ | 中 | 全流量穿透、多端口、内网互通 | ❌ 新增 |
| **Bore** | TCP 端口转发 | ✅ | ❌ | 极低 | 单端口暴露、开发测试 | ✅ 已有 |
| **FRP** | 反向代理 (TCP/UDP/HTTP/HTTPS) | ✅ | ❌ | 低 | Web 服务、多端口、域名绑定 | ❌ 新增 |
| **SSH 反向隧道** | SSH RemoteForward | ✅ | ❌ | 极低 | 临时穿透、已有 SSH 访问 | ❌ 新增 |
| **Cloudflare Tunnel** | 出站连接到 CF 边缘 | ❌ (CF 免费) | ❌ | 低 | Web 服务、免公网 IP | ❌ 新增 |
| **Tailscale/Headscale** | Mesh VPN + DERP 中继 | 可选 | ❌ | 中 | 设备组网、P2P 穿透 | ❌ 新增 |

### 选型策略

```
用户选择穿透需求
  │
  ├─ "我只想暴露一个端口" ──► Bore (最简单)
  │
  ├─ "我要暴露多个端口/整个内网" ──► WireGuard VPN (最强)
  │
  ├─ "我要 Web 服务 + 域名" ──► FRP 或 Cloudflare Tunnel
  │
  ├─ "我已经有 SSH 到公网服务器" ──► SSH 反向隧道 (零部署)
  │
  └─ "我不确定" ──► 自动检测 → 推荐最佳方案
```

---

## 三、架构设计

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     前端: PenetrationPage                        │
│   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│   │ 节点管理  │ │ 实例列表  │ │ 创建向导  │ │ 部署向导  │ │ 配置导出  │ │
│   └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                    API: /api/penetration/*                       │
│   nodes/*  instances/*  deploy  detect  export                  │
├─────────────────────────────────────────────────────────────────┤
│                  PenetrationManager (核心调度)                    │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │  统一接口: create/start/stop/status/exportClientConfig   │  │
│   └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│   ┌──────────────────┐    ┌──────────────────────────────────┐ │
│   │  NodeDeployer     │    │        驱动层                     │ │
│   │  ┌──────────────┐ │    │ ┌──────────┐ ┌──────────┐       │ │
│   │  │ detectNode() │ │    │ │ WireGuard│ │   Bore   │       │ │
│   │  │ deploy()     │ │    │ │  Driver   │ │  Driver  │       │ │
│   │  │ SSH Manager  │ │    │ └──────────┘ └──────────┘       │ │
│   │  │ Local Exec   │ │    │ ┌──────────┐ ┌──────────┐       │ │
│   │  └──────────────┘ │    │ │   FRP    │ │   SSH    │       │ │
│   └──────────────────┘    │ │  Driver  │ │  Driver  │       │ │
│                           │ └──────────┘ └──────────┘       │ │
│                           │ ┌──────────┐                    │ │
│                           │ │Cloudflare│                    │ │
│                           │ │  Driver  │                    │ │
│                           │ └──────────┘                    │ │
│                           └──────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  部署目标 (节点):                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │  ☁️ VPS   │ │ 📦 NAS   │ │ 💻 Linux │ │ 🪟 Win   │  ...     │
│  │ SSH+apt  │ │ SSH+Docker│ │ 本地exec  │ │ 本地exec  │         │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
├─────────────────────────────────────────────────────────────────┤
│  外部二进制/依赖:                                                │
│  bin/bore(✅) bin/frpc(❌) bin/frps(❌) wireguard-tools(系统)    │
│  ssh(系统) cloudflared(❌) docker(NAS推荐)                       │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 数据模型

#### PenetrationNode — 穿透节点模型（部署目标）

```javascript
// 一台设备 = 一个节点，可以部署服务端或客户端
{
  id:           INTEGER,
  name:         STRING,       // "家里NAS"、"阿里云VPS"、"办公电脑"
  
  // 节点类型
  nodeType:     ENUM,         // 'vps' | 'nas' | 'local' | 'cloud'
  
  // 连接信息
  host:         STRING,       // IP/域名
  sshPort:      INTEGER,      // SSH 端口 (默认22)
  sshUser:      STRING,       // SSH 用户名
  sshAuth:      ENUM,         // 'key' | 'password'
  sshKeyPath:   STRING,       // SSH 私钥路径
  sshPassword:  STRING,       // SSH 密码 (加密存储)
  
  // 自动检测结果 (部署时填充)
  osType:       STRING,       // 'ubuntu' | 'centos' | 'debian' | 'synology' | 'qnap' | 'alpine' | 'macos' | 'windows'
  arch:         STRING,       // 'x86_64' | 'aarch64' | 'armv7'
  hasRoot:      BOOLEAN,      // 是否有 root/sudo 权限
  publicIp:     STRING,       // 检测到的公网 IP (如果有)
  
  // 已部署的组件
  installed:    JSON,         // { wireguard: true, bore: true, frp: false, ... }
  
  // 状态
  status:       ENUM,         // 'unknown' | 'reachable' | 'unreachable'
  lastSeenAt:   DATE,
  
  userId:       INTEGER,
  createdAt:    DATE,
  updatedAt:    DATE,
}
```

#### PenetrationInstance — 穿透实例模型

```javascript
// 一个穿透实例连接两个节点，定义端口映射规则
{
  id:           INTEGER,
  name:         STRING,       // 用户命名
  type:         ENUM,         // 'wireguard' | 'bore' | 'frp' | 'ssh' | 'cloudflare'
  
  // 参与的节点
  serverNodeId: INTEGER,     // 服务端节点 (PenetrationNode.id, 可为 null 如果用 Cloudflare)
  clientNodeId: INTEGER,     // 客户端节点 (当前机器为 null)
  
  // 角色: 当前机器在本实例中扮演什么
  role:         ENUM,         // 'server' | 'client' | 'both'
  
  // 穿透映射规则 (JSON 数组)
  // [{ localPort: 3000, remotePort: 80, protocol: 'tcp', domain?: 'xxx.com' }]
  mappings:     JSON,
  
  // 协议配置 (JSON，按 type 不同内容不同)
  // WireGuard: { privateKey, publicKey, address, subnet, dns, listenPort, ... }
  // FRP: { token, serverPort, customDomains, ... }
  // Bore: { secret, ... }
  config:       JSON,
  
  // 运行状态
  status:       ENUM,         // 'created' | 'running' | 'error' | 'stopped'
  pid:          INTEGER,      // 进程 PID
  lastError:    TEXT,         // 最后错误信息
  
  // 统计
  bytesUp:      BIGINT,       // 上行字节
  bytesDown:    BIGINT,       // 下行字节
  lastActiveAt: DATE,         // 最后活跃时间
  
  userId:       INTEGER,
  createdAt:    DATE,
  updatedAt:    DATE,
}
```

### 3.3 统一驱动接口

```javascript
// services/penetration/baseDriver.js
class BasePenetrationDriver {
  /**
   * 生成服务端配置
   * @param {Object} instance - PenetrationInstance
   * @returns {Object} { files: [{path, content, mode}], commands: [string] }
   */
  generateServerConfig(instance) { throw new Error('Not implemented'); }
  
  /**
   * 生成客户端配置
   * @param {Object} instance
   * @returns {Object} { files: [...], commands: [...] }
   */
  generateClientConfig(instance) { throw new Error('Not implemented'); }
  
  /**
   * 启动本地客户端/服务端进程
   * @param {Object} instance
   * @returns {ChildProcess}
   */
  start(instance) { throw new Error('Not implemented'); }
  
  /**
   * 停止进程
   */
  stop(instance) { throw new Error('Not implemented'); }
  
  /**
   * 获取连接状态和统计
   * @returns {{ connected: bool, bytesUp: number, bytesDown: number, peers: [] }}
   */
  getStatus(instance) { throw new Error('Not implemented'); }
  
  /**
   * 生成客户端配置文件（供下载/扫码）
   * @returns {{ content: string, filename: string, qrCode?: string }}
   */
  exportClientConfig(instance) { throw new Error('Not implemented'); }
}
```

---

## 四、各穿透方法详细设计

### 4.1 WireGuard VPN（核心能力）

**原理**: 在公网服务器和本地设备各创建一个 WireGuard 接口，建立加密 UDP 隧道。本地服务通过隧道 IP 直接被公网访问。

```
本地: wg0 10.8.0.2 ──── UDP:51820 ────► 公网: wg0 10.8.0.1
                                           │
                                           ├─ iptables -t nat -A PREROUTING -p tcp --dport 80 -j DNAT --to-destination 10.8.0.2:3000
                                           └─ iptables -A POSTROUTING -s 10.8.0.0/24 -j MASQUERADE
```

**服务端配置生成**:
```ini
# /etc/wireguard/wg0.conf (公网服务器)
[Interface]
PrivateKey = <server_private_key>
Address = 10.8.0.1/24
ListenPort = 51820
PostUp = iptables -t nat -A PREROUTING -p tcp --dport 80 -j DNAT --to-destination 10.8.0.2:3000
PostUp = iptables -A POSTROUTING -s 10.8.0.0/24 -j MASQUERADE
PostDown = iptables -t nat -D PREROUTING -p tcp --dport 80 -j DNAT --to-destination 10.8.0.2:3000
PostDown = iptables -D POSTROUTING -s 10.8.0.0/24 -j MASQUERADE

[Peer]
PublicKey = <client_public_key>
AllowedIPs = 10.8.0.2/32
```

**客户端配置生成**:
```ini
# 客户端 wg0.conf
[Interface]
PrivateKey = <client_private_key>
Address = 10.8.0.2/24
DNS = 8.8.8.8

[Peer]
PublicKey = <server_public_key>
Endpoint = <server_ip>:51820
AllowedIPs = 10.8.0.0/24
PersistentKeepalive = 25
```

**自动 iptables 规则**: 根据用户配置的 mappings，自动生成 PREROUTING DNAT 规则。

**API 端点**:
```
POST /api/penetration/wireguard/setup-server    # 一键部署服务端
POST /api/penetration/wireguard/generate-keys   # 生成密钥对
POST /api/penetration/wireguard/add-mapping     # 添加端口映射
GET  /api/penetration/wireguard/export-config   # 导出客户端配置
```

---

### 4.2 Bore（已有，增强）

**现状**: 已有 bore 客户端和服务器管理，需要整合到统一入口。

**增强项**:
- 整合到 `PenetrationManager` 统一接口
- 增加 `mappings` 概念，支持多端口同时转发
- 前端整合到统一穿透页面
- 保留现有 routes 但新增统一 API 兼容层

---

### 4.3 FRP（新增）

**原理**: 公网服务器运行 frps (服务端)，本地运行 frpc (客户端)。支持 TCP/UDP/HTTP/HTTPS 多种代理类型。

**服务端配置 (frps.toml)**:
```toml
bindPort = 7000
auth.method = "token"
auth.token = "<secret>"

webServer.addr = "0.0.0.0"
webServer.port = 7500
webServer.user = "admin"
webServer.password = "<admin_password>"
```

**客户端配置 (frpc.toml)**:
```toml
serverAddr = "<server_ip>"
serverPort = 7000
auth.method = "token"
auth.token = "<secret>"

[[proxies]]
name = "web"
type = "tcp"
localIP = "127.0.0.1"
localPort = 3000
remotePort = 80

[[proxies]]
name = "web-https"
type = "tcp"
localIP = "127.0.0.1"
localPort = 443
remotePort = 443

[[proxies]]
name = "ssh"
type = "tcp"
localIP = "127.0.0.1"
localPort = 22
remotePort = 2222
```

**自动部署**:
1. SSH 到公网服务器 → 下载 frps → 生成配置 → systemd 注册 → 启动
2. 本地下载 frpc → 生成配置 → 启动

**支持的代理类型**:
- `tcp` — 通用 TCP 转发
- `udp` — UDP 转发
- `http` — 基于 Host 头的 HTTP 虚拟主机（可绑域名）
- `https` — HTTPS 虚拟主机
- `stcp` — 安全 TCP（P2P，需要访问端也运行 frpc）
- `xtcp` — P2P 直连（无需服务器中转）

---

### 4.4 SSH 反向隧道（新增）

**原理**: 利用 SSH 的 `-R` 参数，把远程端口映射到本地。

```bash
# 在本地执行
ssh -N -R 0.0.0.0:8080:localhost:3000 user@server
# → server:8080 → localhost:3000
```

**优势**: 零部署，只要本地能 SSH 到公网服务器即可。
**劣势**: 无自动重连、无流量统计、无 Web 管理。

**实现**: 在 NetTools 中封装 SSH 隧道管理：
- 自动生成 `ssh -R` 命令
- 用 `autossh` 实现断线重连
- 支持多端口映射
- 支持密钥认证

---

### 4.5 Cloudflare Tunnel（新增）

**原理**: 本地运行 `cloudflared`，主动出站连接到 Cloudflare 边缘网络，无需公网 IP。

**优势**:
- **完全不需要公网服务器**！Cloudflare 免费提供中继
- 自带 HTTPS、DDoS 防护
- 支持 HTTP/TCP/SSH/UDP

**劣势**:
- 需要 Cloudflare 账号和域名
- 流量经过 Cloudflare（有延迟）
- 不适合大流量场景

**实现**:
1. 用户在前端输入 Cloudflare Tunnel Token（从 CF Dashboard 获取）
2. 自动下载 `cloudflared` 二进制
3. 启动 `cloudflared tunnel run --token <token>`
4. 支持配置 ingress 规则

---

## 五、NodeDeployer — 多节点部署系统

### 5.1 支持的部署目标

| 目标类型 | nodeType | 典型设备 | 特殊处理 |
|---------|----------|---------|---------|
| **VPS/云服务器** | `vps` | 阿里云、腾讯云、AWS、Vultr | 标准 Linux，apt/yum，有 root |
| **NAS** | `nas` | 群晖 Synology、QNAP、威联通、TrueNAS | Docker 优先，部分有 root 但包管理受限 |
| **本地电脑** | `local` | Windows/Mac/Linux 台式机/笔记本 | 可直接本地执行，无需 SSH |
| **云主机** | `cloud` | 轻量应用服务器、函数计算 | 同 VPS，但可能有安全组限制 |

### 5.2 部署策略矩阵

```
目标类型 × 穿透方法 → 部署策略

              WireGuard      Bore        FRP         SSH        Cloudflare
VPS           wg-quick       bore bin    frps/frpc   autossh     cloudflared
              +systemd       +systemd    +systemd    +systemd    +systemd

NAS(群晖)     Docker ⭐       bore bin    Docker ⭐   autossh     cloudflared
              或套件中心       (直接运行)   或直接运行   (直接运行)   (直接运行)

NAS(QNAP)     Docker ⭐       bore bin    Docker ⭐   autossh     cloudflared
              或QPKG          (直接运行)   或直接运行   (直接运行)   (直接运行)

本地(Linux)   wg-quick       bore bin    frpc        autossh     cloudflared
              +systemd       (直接运行)   (直接运行)   (直接运行)   (直接运行)

本地(macOS)   brew install   bore bin    brew/frpc   autossh     cloudflared
              wireguard-tools(直接运行)   (直接运行)   (直接运行)   (直接运行)

本地(Windows)  WireGuard GUI  bore.exe   frpc.exe    plink       cloudflared.exe
              或 winsw       (直接运行)   (直接运行)   (直接运行)   (直接运行)
```

> ⭐ = 推荐方案。NAS 上 Docker 部署最可靠，不影响 NAS 系统稳定性。

### 5.3 节点自动检测流程

```javascript
// NodeDeployer.detectNode(sshConn) 或 本地检测
async function detectNode(connection) {
  // 1. 检测操作系统
  const osRelease = await exec('cat /etc/os-release 2>/dev/null || uname -s');
  // → ubuntu / centos / debian / synology / qnap / alpine / darwin / windows_nt
  
  // 2. 检测架构
  const arch = await exec('uname -m');
  // → x86_64 / aarch64 / armv7l
  
  // 3. 检测是否有 root
  const uid = await exec('id -u');
  const hasRoot = uid.trim() === '0';
  
  // 4. 检测包管理器
  const pkgManager = await detectPackageManager();
  // → apt / yum / apk / opkg / brew / choco / none
  
  // 5. 检测 Docker 是否可用
  const hasDocker = await exec('docker --version 2>/dev/null').catch(() => null);
  
  // 6. 检测已有穿透组件
  const installed = {};
  installed.wireguard = !!(await exec('which wg 2>/dev/null').catch(() => null));
  installed.bore = !!(await exec('which bore 2>/dev/null').catch(() => null));
  installed.frp = !!(await exec('which frpc 2>/dev/null || which frps 2>/dev/null').catch(() => null));
  installed.docker = !!hasDocker;
  
  // 7. 检测公网 IP
  const publicIp = await exec('curl -s ifconfig.me || curl -s ip.sb').catch(() => null);
  
  // 8. 特殊: 检测是否为 NAS
  const isSynology = !!(await exec('cat /etc.defaults/VERSION 2>/dev/null').catch(() => null));
  const isQNAP = !!(await exec('getcfg System "Platform" -f /etc/platform.conf 2>/dev/null').catch(() => null));
  
  return {
    osType: isSynology ? 'synology' : isQNAP ? 'qnap' : detectOsType(osRelease),
    arch: arch.trim(),
    hasRoot,
    pkgManager,
    hasDocker: !!hasDocker,
    installed,
    publicIp: publicIp?.trim(),
    isNAS: isSynology || isQNAP,
  };
}
```

### 5.4 NAS 部署策略详解

#### 群晖 Synology

```bash
# 群晖有 SSH，但没有 apt/yum，包管理受限
# 最佳策略: Docker 或 群晖套件

# WireGuard (Docker 方式 - 推荐)
docker run -d \
  --name=wireguard \
  --cap-add=NET_ADMIN \
  --cap-add=SYS_MODULE \
  -v /volume1/docker/wireguard/config:/config \
  -v /lib/modules:/lib/modules \
  -e PUID=1000 -e PGID=1000 \
  -e TZ=Asia/Shanghai \
  -p 51820:51820/udp \
  linuxserver/wireguard

# FRP (直接下载二进制 - 轻量)
cd /volume1/nettools/bin/
wget https://github.com/fatedier/frp/releases/download/v0.61.0/frp_0.61.0_linux_amd64.tar.gz
tar xzf frp_0.61.0_linux_amd64.tar.gz
cp frp_0.61.0_linux_amd64/frps . && cp frp_0.61.0_linux_amd64/frpc .
chmod +x frps frpc

# Bore (直接运行)
cp bore /volume1/nettools/bin/bore && chmod +x /volume1/nettools/bin/bore

# 开机自启 (群晖任务计划)
# → 写入 /usr/local/etc/rc.d/ 或 群晖控制面板 → 任务计划 → 开机触发
```

#### QNAP 威联通

```bash
# QNAP 类似，Docker 为首选
# Container Station 通常已安装

# WireGuard (Docker)
docker run -d --name=wireguard --cap-add=NET_ADMIN --cap-add=SYS_MODULE \
  -v /share/CACHEDEV1_DATA/docker/wireguard/config:/config \
  -p 51820:51820/udp linuxserver/wireguard

# FRP/Bore: 同群晖，直接下载二进制到 /share/CACHEDEV1_DATA/nettools/bin/

# 开机自启: QNAP → 控制台 → 开机自动启动 → 添加自定义应用
```

### 5.5 本地电脑部署策略

#### 本地直接执行（无需 SSH）

当 NetTools 运行在本地电脑上时，穿透客户端可直接 spawn 进程：

```javascript
// 本地节点不需要 SSH，直接执行
if (node.nodeType === 'local') {
  // 直接 spawn 本地二进制
  const proc = spawn('./bin/wireguard/wg-quick', ['up', configPath]);
} else {
  // 远程节点通过 SSH 执行
  const ssh = await createSSHConnection(node);
  await ssh.execCommand(`wg-quick up ${remoteConfigPath}`);
}
```

#### Windows 本地部署

```powershell
# WireGuard: 下载官方安装包
# https://www.wireguard.com/install/
# 或使用 Chocolatey: choco install wireguard

# FRP: 下载二进制
Invoke-WebRequest -Uri "https://github.com/fatedier/frp/releases/download/v0.61.0/frp_0.61.0_windows_amd64.zip" -OutFile frp.zip
Expand-Archive frp.zip -DestinationPath .\bin\

# Bore: 已有 Linux 版，需下载 Windows 版
# cloudflared: 下载 Windows 版
```

#### macOS 本地部署

```bash
# WireGuard
brew install wireguard-tools

# FRP
brew install frpc
# 或直接下载
curl -LO https://github.com/fatedier/frp/releases/download/v0.61.0/frp_0.61.0_darwin_amd64.tar.gz

# Bore: 直接下载 macOS 版
# cloudflared: brew install cloudflare/cloudflare/cloudflared
```

### 5.6 部署流程 (统一)

```
用户点击"部署到节点"
  │
  ▼
选择目标节点 (已有节点 或 新建节点)
  │
  ▼
NodeDeployer 根据节点类型选择策略:
  │
  ├─ 节点是本地 (local)
  │   └─ 直接本地执行安装脚本
  │
  ├─ 节点是远程 (vps/nas/cloud)
  │   ├─ SSH 连接
  │   ├─ detectNode() 自动检测
  │   ├─ 根据 osType + hasDocker 选择安装方式:
  │   │   ├─ NAS + Docker → docker run
  │   │   ├─ Linux + apt → apt install
  │   │   ├─ Linux + yum → yum install
  │   │   └─ 通用 → 下载二进制到 ~/nettools/bin/
  │   ├─ 生成配置文件
  │   ├─ 配置防火墙
  │   └─ 注册开机自启
  │
  ▼
返回部署结果 + 配置信息
```

### 5.7 一键部署 API

```
# 节点管理
GET    /api/penetration/nodes                    # 列出所有节点
POST   /api/penetration/nodes                    # 创建节点 (输入连接信息)
GET    /api/penetration/nodes/:id                # 节点详情
PUT    /api/penetration/nodes/:id                # 更新节点
DELETE /api/penetration/nodes/:id                # 删除节点

# 节点操作
POST   /api/penetration/nodes/:id/detect         # 自动检测节点信息
POST   /api/penetration/nodes/:id/test           # 测试连通性
POST   /api/penetration/nodes/:id/deploy         # 部署穿透组件到节点
GET    /api/penetration/nodes/:id/status         # 节点状态 (已安装组件、运行中实例)

# 部署组件
Body: {
  components: ['wireguard', 'bore', 'frp'],      // 要安装的组件
  role: 'server' | 'client',                     // 部署角色
  config: { listenPort: 51820, mappings: [...] } // 配置
}
```

---

## 六、PenetrationManager — 核心调度器

### 6.1 文件结构

```
nettools-backend-node/src/services/penetration/
├── index.js                    # PenetrationManager 主类
├── baseDriver.js               # 驱动基类
├── wireguardDriver.js          # WireGuard 驱动 (~300行)
├── boreDriver.js               # Bore 驱动 (包装现有, ~100行)
├── frpDriver.js                # FRP 驱动 (~250行)
├── sshDriver.js                # SSH 反向隧道驱动 (~150行)
├── cloudflareDriver.js         # Cloudflare Tunnel 驱动 (~150行)
├── serverDeployer.js           # 一键部署 (~200行)
├── keyGenerator.js             # 密钥对生成工具
└── portMapper.js               # iptables/nftables 端口映射管理
```

### 6.2 PenetrationManager 主类

```javascript
// services/penetration/index.js
class PenetrationManager {
  constructor() {
    this.drivers = {
      wireguard: new WireGuardDriver(),
      bore: new BoreDriver(),
      frp: new FrpDriver(),
      ssh: new SshDriver(),
      cloudflare: new CloudflareDriver(),
    };
    this.runningInstances = new Map(); // id -> { driver, process, startTime }
  }

  /**
   * 创建穿透实例
   */
  async create(data) {
    const instance = await PenetrationInstance.create(data);
    return instance;
  }

  /**
   * 启动穿透
   */
  async start(instanceId) {
    const instance = await PenetrationInstance.findByPk(instanceId);
    const driver = this.drivers[instance.type];
    if (!driver) throw new Error(`Unknown type: ${instance.type}`);
    
    const proc = await driver.start(instance);
    this.runningInstances.set(instanceId, { driver, process: proc, startTime: Date.now() });
    await instance.update({ status: 'running', pid: proc.pid });
    
    // 监控进程退出
    proc.on('exit', async () => {
      this.runningInstances.delete(instanceId);
      await instance.update({ status: 'stopped' });
    });
    
    return { success: true };
  }

  /**
   * 停止穿透
   */
  async stop(instanceId) {
    const entry = this.runningInstances.get(instanceId);
    if (entry) {
      entry.driver.stop(entry.process);
      this.runningInstances.delete(instanceId);
    }
    await PenetrationInstance.update({ status: 'stopped' }, { where: { id: instanceId } });
  }

  /**
   * 获取状态 (含流量统计)
   */
  async getStatus(instanceId) {
    const entry = this.runningInstances.get(instanceId);
    if (!entry) return { running: false };
    return entry.driver.getStatus(entry.process);
  }

  /**
   * 一键部署到远程服务器
   */
  async deployToServer(instanceId, serverInfo) {
    const instance = await PenetrationInstance.findByPk(instanceId);
    const driver = this.drivers[instance.type];
    const deployer = new ServerDeployer(serverInfo);
    
    // 生成服务端配置
    const serverConfig = driver.generateServerConfig(instance);
    
    // 部署
    const result = await deployer.deploy(serverConfig);
    
    // 更新实例
    await instance.update({
      serverHost: serverInfo.host,
      serverPort: serverConfig.listenPort,
      config: { ...instance.config, serverPublicKey: result.serverPublicKey },
    });
    
    return result;
  }

  /**
   * 导出客户端配置
   */
  exportClientConfig(instanceId) {
    const instance = PenetrationInstance.findByPk(instanceId);
    const driver = this.drivers[instance.type];
    return driver.exportClientConfig(instance);
  }

  /**
   * 优雅关闭所有
   */
  stopAll() {
    for (const [id, entry] of this.runningInstances) {
      try { entry.driver.stop(entry.process); } catch {}
    }
    this.runningInstances.clear();
  }
}
```

---

## 七、路由设计

### 7.1 统一 API（新增）

```
# ---- 节点管理 ----
GET    /api/penetration/nodes                    # 列出所有节点
POST   /api/penetration/nodes                    # 创建节点
GET    /api/penetration/nodes/:id                # 节点详情
PUT    /api/penetration/nodes/:id                # 更新节点
DELETE /api/penetration/nodes/:id                # 删除节点
POST   /api/penetration/nodes/:id/detect         # 自动检测节点系统信息
POST   /api/penetration/nodes/:id/test           # 测试连通性
POST   /api/penetration/nodes/:id/deploy         # 部署穿透组件
GET    /api/penetration/nodes/:id/status         # 节点状态

# ---- 穿透实例 ----
GET    /api/penetration/instances                # 列出所有穿透实例
POST   /api/penetration/instances                # 创建穿透实例
GET    /api/penetration/instances/:id            # 获取单个实例详情
PUT    /api/penetration/instances/:id            # 更新实例配置
DELETE /api/penetration/instances/:id            # 删除实例

# ---- 生命周期 ----
POST   /api/penetration/instances/:id/start      # 启动
POST   /api/penetration/instances/:id/stop       # 停止
POST   /api/penetration/instances/:id/restart    # 重启

# ---- 状态与监控 ----
GET    /api/penetration/instances/:id/status     # 运行状态 + 流量统计
GET    /api/penetration/instances/:id/logs       # 运行日志

# ---- 部署 (实例级别) ----
POST   /api/penetration/instances/:id/deploy     # 一键部署服务端到目标节点

# ---- 配置导出 ----
GET    /api/penetration/instances/:id/export     # 导出客户端配置
GET    /api/penetration/instances/:id/qrcode     # 生成二维码 (WireGuard)

# ---- 工具 ----
POST   /api/penetration/tools/generate-keys     # 生成密钥对
GET    /api/penetration/tools/detect-local       # 检测本机信息
GET    /api/penetration/types                    # 获取支持的穿透类型列表
```

### 7.2 兼容层（保留旧路由）

现有 `/api/tunnels/*` 和 `/api/vpn/*` 路由保留，内部转发到统一 PenetrationManager。

---

## 八、前端页面设计

### 8.1 新增页面: PenetrationPage

```
┌─────────────────────────────────────────────────────────────────┐
│  🔗 穿透管理                                       [+ 添加节点] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─ 📡 节点列表 ─────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  ☁️ 阿里云VPS          47.100.xx.xx  Ubuntu 22.04        │  │
│  │     ✅WireGuard ✅Bore ✅FRP  │ 2个实例运行中         ⋮  │  │
│  │                                                           │  │
│  │  📦 群晖NAS            192.168.1.100  DSM 7.2           │  │
│  │     ✅Docker ✅WireGuard ❌FRP  │ 1个实例运行中       ⋮  │  │
│  │                                                           │  │
│  │  💻 本机               localhost      macOS 15.0         │  │
│  │     ✅Bore ✅SSH  │ 3个实例运行中                       ⋮  │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ 🔌 穿透实例 ─────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  🟢 家里Web → 阿里云        WireGuard                    │  │
│  │     💻本机 ──── ☁️阿里云VPS                               │  │
│  │     3000→80  │ ↑12.3MB ↓45.6MB │ 运行 2h15m         ⋮   │  │
│  │     [停止] [导出配置] [查看日志]                           │  │
│  │                                                           │  │
│  │  🟢 NAS照片 → 阿里云        FRP                          │  │
│  │     📦群晖NAS ──── ☁️阿里云VPS                            │  │
│  │     443→443  │ ↑890MB ↓2.1GB │ 运行 5d3h            ⋮   │  │
│  │                                                           │  │
│  │  ⚪ 开发调试               Bore                           │  │
│  │     💻本机 ──── ☁️阿里云VPS                               │  │
│  │     5173→random │ 已停止                              ⋮   │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│            [+ 创建穿透实例]                                      │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 添加节点向导

```
┌─ 添加穿透节点 ──────────────────────────────────────────────────┐
│                                                                 │
│  Step 1: 节点类型                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ ☁️        │ │ 📦        │ │ 💻        │ │ 🪟        │          │
│  │ 云服务器   │ │   NAS    │ │ Linux   │ │ Windows  │          │
│  │ VPS      │ │ 群晖/QNAP │ │ 电脑    │ │ 电脑     │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│                                                                 │
│  Step 2: 连接方式                                                │
│  ○ 本地 (NetTools 本机)  ← 自动检测，无需填写                    │
│  ○ SSH 远程连接                                                  │
│     主机: [________________] 端口: [22__]                       │
│     用户: [________________]                                    │
│     认证: ○ 密钥 [选择文件____]  ○ 密码 [____________]          │
│                                                                 │
│  Step 3: 节点信息                                                │
│  名称: [________________]  ("家里NAS"、"阿里云VPS")             │
│                                                                 │
│                    [ 取消 ]  [ 添加并检测 ]                       │
└─────────────────────────────────────────────────────────────────┘

  ↓ 检测完成后自动展开:

┌─ 节点检测结果 ──────────────────────────────────────────────────┐
│  ✅ 连接成功                                                     │
│                                                                 │
│  操作系统: Ubuntu 22.04.3 LTS                                   │
│  架构:     x86_64                                               │
│  Root权限: ✅                                                    │
│  Docker:   ✅ 24.0.7                                            │
│  公网IP:   47.100.xx.xx                                         │
│                                                                 │
│  已安装组件:                                                     │
│    ✅ WireGuard   ✅ SSH   ❌ FRP   ❌ Bore   ❌ Cloudflare     │
│                                                                 │
│            [ 跳过 ]  [ 安装缺失组件 ]                             │
└─────────────────────────────────────────────────────────────────┘
```

### 8.3 创建穿透实例向导

```
┌─ 创建穿透实例 ──────────────────────────────────────────────────┐
│                                                                 │
│  Step 1: 选择穿透方法                                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ 🔷        │ │ 🟢        │ │ 🟠        │ │ ⚡        │          │
│  │ WireGuard │ │  Bore    │ │   FRP    │ │   SSH    │          │
│  │ 全流量穿透 │ │ 简单快速  │ │ 功能丰富  │ │ 零部署    │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│  ┌──────────┐                                                  │
│  │ 🌐        │                                                  │
│  │Cloudflare│  ← 不需要公网服务器！                             │
│  │ 免费穿透  │                                                  │
│  └──────────┘                                                  │
│                                                                 │
│  Step 2: 选择节点                                                │
│  客户端 (发起连接的设备):                                         │
│    [💻 本机 ▼]                                                  │
│  服务端 (接收连接的设备):                                         │
│    [☁️ 阿里云VPS ▼]   ← Cloudflare 无需服务端                   │
│                                                                 │
│  Step 3: 端口映射                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  本地端口    远程端口    协议    域名(可选)      [操作]   │   │
│  │  [3000___]  [80____]   [TCP▾]  [________]    [🗑️ 删除]  │   │
│  │  [5432___]  [5432__]   [TCP▾]  [________]    [🗑️ 删除]  │   │
│  │  [22_____]  [2222_]   [TCP▾]  [________]    [🗑️ 删除]  │   │
│  │                                            [+ 添加映射]  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Step 4: 高级配置 (可选)                                         │
│  WireGuard 子网: [10.8.0.0/24]  监听端口: [51820]              │
│  FRP 认证 Token: [________________]                             │
│                                                                 │
│                    [ 取消 ]  [ 创建 ]                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 九、实现计划（Phase 3 详细排期）

### Day 8: 数据模型 + PenetrationManager 骨架 + 节点管理

| 任务 | 文件 | 说明 |
|------|------|------|
| PenetrationNode 模型 | `models/penetrationnode.js` | 节点模型 (VPS/NAS/本地) |
| PenetrationInstance 模型 | `models/penetrationinstance.js` | 穿透实例模型 (含 serverNodeId/clientNodeId) |
| BasePenetrationDriver | `services/penetration/baseDriver.js` | 驱动基类 + 接口定义 |
| PenetrationManager | `services/penetration/index.js` | 核心调度器骨架 |
| 统一 API 路由 | `routes/penetration.js` | 节点 CRUD + 实例 CRUD + 生命周期端点 |
| 模型注册到 init.js | `src/init.js` | 注册新模型 |
| 本地节点自动注册 | 启动时 | NetTools 启动时自动检测本机并创建 local 节点 |

### Day 9: WireGuard 驱动 + 密钥生成 + 节点检测

| 任务 | 文件 | 说明 |
|------|------|------|
| WireGuard 驱动 | `services/penetration/wireguardDriver.js` | 配置生成 + 进程管理 + 状态查询 |
| 密钥生成工具 | `services/penetration/keyGenerator.js` | `wg genkey` / `wg pubkey` 封装 |
| iptables 端口映射 | `services/penetration/portMapper.js` | DNAT/MASQUERADE 规则自动生成 |
| 节点自动检测 | `services/penetration/nodeDeployer.js` detectNode() | SSH连接→检测OS/arch/Docker/公网IP/已有组件 |
| WireGuard 客户端配置导出 | driver.exportClientConfig() | 生成 .conf + QR Code |

### Day 10: FRP 驱动 + Bore 驱动整合 + 多目标部署

| 任务 | 文件 | 说明 |
|------|------|------|
| FRP 驱动 | `services/penetration/frpDriver.js` | frpc/frps 配置生成 + 进程管理 |
| FRP 二进制获取 | 启动时自动检测/下载 | 检测 bin/frpc，不存在时提示下载 |
| Bore 驱动 | `services/penetration/boreDriver.js` | 包装现有 bore 逻辑 |
| SSH 反向隧道驱动 | `services/penetration/sshDriver.js` | ssh -R 封装 + autossh 重连 |
| Cloudflare 驱动 | `services/penetration/cloudflareDriver.js` | token 模式启动 cloudflared |

### Day 11: NodeDeployer 多节点部署 + NAS/本地适配

| 任务 | 文件 | 说明 |
|------|------|------|
| NodeDeployer 核心 | `services/penetration/nodeDeployer.js` | SSH部署 + 本地执行双模式 |
| NAS 部署策略 | deployer 内 | 群晖/QNAP Docker 优先 + 二进制 fallback |
| VPS 部署策略 | deployer 内 | apt/yum 安装 + systemd 注册 |
| Windows/macOS 本地策略 | deployer 内 | 检测 brew/choco，下载对应平台二进制 |
| 防火墙自动配置 | deployer 内 | ufw / firewall-cmd / iptables / 群晖防火墙 |
| 部署 API | `POST /nodes/:id/deploy` | 前端一键触发 → 检测 → 安装 → 配置 → 启动 |

### Day 12: 前端页面 + Clash TUN + 全流程联调

| 任务 | 文件 | 说明 |
|------|------|------|
| PenetrationPage | `pages/PenetrationPage.tsx` | 节点列表 + 实例列表 + 状态展示 |
| NodeManager 组件 | `components/penetration/NodeManager.tsx` | 添加节点 + 检测 + 部署 |
| CreateWizard 组件 | `components/penetration/CreateWizard.tsx` | 分步引导创建穿透实例 |
| DeployDialog 组件 | `components/penetration/DeployDialog.tsx` | 一键部署对话框 |
| InstanceCard 组件 | `components/penetration/InstanceCard.tsx` | 实例卡片 (状态/流量/操作) |
| Clash TUN 模式集成 | `clashManager.js` | TUN 开关 + 配置 |
| 全流程联调 | - | 添加节点→检测→部署→创建实例→启动→穿透验证 |

---

### 典型使用场景联调目标

| 场景 | 操作 | 验证 |
|------|------|------|
| **场景1: 本地→VPS** | 添加阿里云VPS节点 → 一键部署WireGuard → 创建实例(本机:3000→VPS:80) → 启动 | 浏览器访问 VPS_IP:80 = 本地:3000 |
| **场景2: NAS→VPS** | 添加群晖NAS节点 → 检测发现Docker → 部署WireGuard到NAS → 创建实例(NAS:443→VPS:443) → 启动 | 访问 VPS:443 = NAS Web界面 |
| **场景3: 本地→VPS (Bore)** | 添加VPS节点 → 部署Bore Server → 创建实例(本机:5173→VPS) → 启动 | 访问 VPS:随机端口 = 本地Vite dev |
| **场景4: 本地→NAS (WireGuard组网)** | 添加NAS节点 → 部署WireGuard → 创建实例(本机↔NAS) → 启动 | 本机 ping 10.8.0.3 = NAS隧道IP |
| **场景5: Cloudflare (无公网IP)** | 创建实例(Cloudflare类型) → 输入Token → 启动 | 访问域名 = 本地服务 |

---

## 十、与现有代码的关系

### 保留的代码
- `boreServerManager.js` — 底层 bore 进程管理，BoreDriver 内部调用
- `tunnels.js` routes — 保留兼容，内部转发到 PenetrationManager
- `tunnelServer.js` routes — 保留兼容
- `vpn.js` routes — 保留兼容，WireGuard 相关功能迁移到新驱动
- `clashManager.js` — 独立模块，不受影响

### 需要新增的文件

```
新增:
  models/penetrationnode.js          # 节点模型
  models/penetrationinstance.js      # 穿透实例模型
  services/penetration/index.js      # PenetrationManager 主类
  services/penetration/baseDriver.js # 驱动基类
  services/penetration/wireguardDriver.js
  services/penetration/boreDriver.js
  services/penetration/frpDriver.js
  services/penetration/sshDriver.js
  services/penetration/cloudflareDriver.js
  services/penetration/nodeDeployer.js     # 多节点部署 (替代 serverDeployer)
  services/penetration/keyGenerator.js
  services/penetration/portMapper.js
  routes/penetration.js              # 统一 API 路由
  frontend/pages/PenetrationPage.tsx
  frontend/components/penetration/NodeManager.tsx       # 节点管理组件
  frontend/components/penetration/CreateWizard.tsx      # 创建向导
  frontend/components/penetration/DeployDialog.tsx      # 部署向导
  frontend/components/penetration/InstanceCard.tsx      # 实例卡片

需要下载:
  bin/frpc           (FRP 客户端, ~15MB)
  bin/frps           (FRP 服务端, ~15MB)

系统依赖 (按目标类型):
  VPS:    wireguard-tools, autossh
  NAS:    docker (推荐)
  本地:   按需安装 (wireguard-tools / frpc / cloudflared)
```

---

## 十一、验收标准

1. **WireGuard 穿透**: 在 VPS 上一键部署 WireGuard 服务端 → 本地启动客户端 → 通过隧道 IP 访问本地 Web 服务
2. **Bore 穿透**: 在 VPS 启动 bore server → 本地 bore client 连接 → 通过 VPS 端口访问本地服务
3. **FRP 穿透**: 在 VPS 一键部署 frps → 本地 frpc 连接 → 多端口同时穿透
4. **SSH 隧道**: 输入 VPS SSH 信息 → 自动生成反向隧道 → 端口映射生效
5. **Cloudflare Tunnel**: 输入 token → 启动 cloudflared → 通过域名访问本地服务
6. **前端统一管理**: 创建/启动/停止/删除/导出配置 均在穿透页面完成
7. **一键部署**: 点击部署 → 30 秒内完成服务器端配置 → 自动启动服务

---

## 十二、Phase 3 与开发计划的对齐

| 原计划 (Day 8-12) | 重设计后 |
|---|---|
| Day 8: Bore 客户端隧道 | Day 8: 数据模型 + PenetrationManager 骨架 |
| Day 9: Bore 服务器部署 | Day 9: WireGuard 驱动 + 密钥生成 |
| Day 10: Clash/Mihomo 二进制 | Day 10: FRP 驱动 + Bore 整合 |
| Day 11: Clash 规则与代理组 | Day 11: ServerDeployer 一键部署 |
| Day 12: 系统代理 + TUN + 订阅 | Day 12: 前端页面 + TUN 模式 + 联调 |

> Clash 相关工作 (规则/代理组/订阅) 被压缩到 Day 12 穿插完成，因为 Clash 主要已有代码基础较完整，主要是前端联通工作。
