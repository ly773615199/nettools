# NetTools

<p align="center">
  <strong>综合网络工具平台 — 文件管理 + 隧道 + 代理 + 更多</strong>
</p>

<p align="center">
  <a href="#功能特性">功能</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="#技术栈">技术栈</a> ·
  <a href="#部署">部署</a> ·
  <a href="#开发">开发</a>
</p>

---

## 简介

NetTools 是一个综合性的网络工具软件，以 **OpenList 文件管理** 为核心，集成 **Bore 隧道** 和 **Clash 代理** 为辅助功能。通过统一界面管理文件、网络隧道和代理服务。

## 功能特性

### 📁 统一文件管理
- 支持 **11 种存储服务**: 本地存储、S3、WebDAV、FTP、SFTP、SMB、阿里云盘、OneDrive、Google Drive、百度网盘、坚果云
- 文件预览: 文本、图片、PDF、Markdown、Office 文档
- 文件操作: 上传、下载、新建、重命名、移动、复制、删除

### 🚇 Bore 隧道
- 本地端口转发到远程服务器，绕过 NAT 防火墙
- 自托管隧道服务器，自定义端口范围和认证
- 一键启动/停止隧道连接

### 🌐 Clash 代理
- 多协议代理支持 (HTTP、SOCKS5、SS、V2Ray 等)
- 规则配置和管理，智能分流
- 系统代理和 TUN 模式
- 订阅解析和代理导入

### 🖥️ 桌面应用
- Electron 跨平台桌面应用 (Windows / macOS / Linux)
- 自动启动后端服务
- 系统托盘常驻

### 🔧 其他工具
- 网络状态监控 (接口、流量、连接数)
- Ping / HTTP 连接测试
- 网络环境自动适配

## 快速开始

### Docker (推荐)

```bash
git clone https://github.com/ly773615199/nettools.git
cd nettools
cp .env.example .env
# 编辑 .env 修改 JWT_SECRET
docker-compose up -d
```

访问 `http://localhost`，默认账号: `admin` / `password`

### 传统部署

```bash
# 后端
cd nettools-backend-node
npm install
npm start

# 前端（另一个终端）
cd nettools-native/frontend
npm install
npm run dev
```

- 前端: http://localhost:5173
- 后端 API: http://localhost:8000

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面端 | Electron 33 |
| 前端 | React 19 + TypeScript + Vite 8 + MUI 7 |
| 后端 | Node.js 22 + Express 4 + SQLite (better-sqlite3) |
| 认证 | JWT + bcrypt |
| WebSocket | ws |
| 日志 | Winston |
| 外部工具 | bore (Rust 隧道) + mihomo (Clash Meta 代理) |

## 项目结构

```
nettools/
├── nettools-backend-node/        # Node.js 后端
│   ├── src/
│   │   ├── index.js              # 入口 + 路由注册
│   │   ├── routes/               # API 路由 (16+)
│   │   ├── services/             # 业务逻辑
│   │   ├── drivers/              # 存储驱动 (11)
│   │   ├── models/               # 数据模型 (9)
│   │   └── utils/                # 工具函数
│   └── package.json
├── nettools-native/frontend/     # React 前端 + Electron
│   ├── src/
│   │   ├── pages/                # 页面组件 (13)
│   │   └── core/                 # 服务层、API 客户端
│   ├── main.js                   # Electron 主进程
│   ├── preload.js                # Electron 预加载
│   └── package.json
├── bin/                          # 外部二进制
│   ├── bore                      # 隧道工具
│   └── mihomo                    # 代理内核
├── docker-compose.yml            # Docker 编排
├── DEPLOYMENT.md                 # 部署文档
├── 开发目标.txt                   # 功能目标定义
└── 开发计划.md                    # 开发计划
```

## API 端点

| 路径 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/api/auth/login` | POST | 用户登录 |
| `/api/storages` | GET/POST | 存储管理 |
| `/api/storages/:id/browse` | GET | 浏览文件 |
| `/api/tunnels` | GET/POST | 隧道管理 |
| `/api/proxies` | GET/POST | 代理管理 |
| `/api/clash/*` | * | Clash 控制 |
| `/api/network/*` | * | 网络监控 |
| `/api/downloads` | GET/POST | 下载管理 |
| `/api/system/*` | * | 系统设置 |

完整 API 文档见 [DEPLOYMENT.md](DEPLOYMENT.md)。

## 部署

- **Docker**: `docker-compose up -d` — 详见 [DEPLOYMENT.md](DEPLOYMENT.md#docker-部署推荐)
- **传统部署**: Node.js 直接运行 — 详见 [DEPLOYMENT.md](DEPLOYMENT.md#传统部署)
- **Electron**: 打包桌面应用 — 详见 [DEPLOYMENT.md](DEPLOYMENT.md#electron-桌面应用)

## 开发

### 环境要求
- Node.js 22+
- npm 10+

### 启动开发环境

```bash
# 终端 1: 后端
cd nettools-backend-node && npm install && npm run dev

# 终端 2: 前端
cd nettools-native/frontend && npm install && npm run dev

# 终端 3: Electron (可选)
cd nettools-native/frontend && npm run electron:dev
```

### 代码规范
- TypeScript 严格模式
- ESLint + Prettier

## 许可

本项目为开源项目。
