# NetTools 部署文档

> 版本: 1.0.0 | 更新: 2026-04-06

## 目录

- [快速开始](#快速开始)
- [Docker 部署（推荐）](#docker-部署推荐)
- [传统部署](#传统部署)
- [Electron 桌面应用](#electron-桌面应用)
- [环境变量](#环境变量)
- [安全配置](#安全配置)
- [常见问题](#常见问题)

---

## 快速开始

```bash
# Docker 一键启动
git clone https://github.com/ly773615199/nettools.git
cd nettools
cp .env.example .env
# 编辑 .env 修改 JWT_SECRET
docker-compose up -d

# 访问 http://localhost
# 默认账号: admin / password
```

---

## Docker 部署（推荐）

### 前置要求

- Docker 20.10+
- Docker Compose 2.0+

### 步骤

```bash
# 1. 克隆项目
git clone https://github.com/ly773615199/nettools.git
cd nettools

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，至少修改 JWT_SECRET

# 3. 构建并启动
docker-compose build
docker-compose up -d

# 4. 查看状态
docker-compose ps
docker-compose logs -f backend

# 5. 停止
docker-compose down
```

### 服务说明

| 服务 | 端口 | 说明 |
|------|------|------|
| frontend | 80 (可配置) | Nginx 反向代理 + SPA |
| backend | 8000 (可配置) | Node.js API 服务 |

### 数据持久化

| Volume | 说明 |
|--------|------|
| `backend-data` | SQLite 数据库 + 存储配置 |
| `backend-downloads` | 下载文件目录 |
| `backend-logs` | 运行日志 |

### 自定义端口

```bash
# .env
FRONTEND_PORT=3000
BACKEND_PORT=9000

docker-compose up -d
# 前端访问: http://localhost:3000
```

---

## 传统部署

### 前置要求

- Node.js 22+
- npm 10+

### 后端部署

```bash
cd nettools-backend-node

# 安装依赖
npm install

# 配置环境变量（可选）
cp ../.env.example .env

# 启动
npm start
# 或开发模式
npm run dev

# 后端运行在 http://localhost:8000
```

### 前端部署

```bash
cd nettools-native/frontend

# 安装依赖
npm install

# 开发模式（含热更新）
npm run dev
# 访问 http://localhost:5173

# 生产构建
npm run build
# 产出在 dist/ 目录，用 Nginx 等托管
```

### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/nettools/native/frontend/dist;
    index index.html;

    # SPA 路由
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket 代理
    location /ws {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_read_timeout 86400;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## Electron 桌面应用

### 开发模式

```bash
cd nettools-native/frontend
npm install
npm run dev          # 启动 Vite 开发服务器
npm run electron:dev # 启动 Electron 窗口
```

### 打包

```bash
cd nettools-native/frontend
npm run build        # 构建前端

# 打包当前平台
npm run electron:build

# 指定平台
npm run electron:build:win     # Windows NSIS 安装包
npm run electron:build:mac     # macOS DMG
npm run electron:build:linux   # Linux AppImage + DEB

# 产出在 release/ 目录
```

### 打包说明

- 后端代码自动包含在 `extraResources/backend` 中
- Electron 启动时自动 fork 后端子进程
- 退出时自动停止后端进程

---

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 8000 | 后端服务端口 |
| `NODE_ENV` | development | 运行环境 (development/production) |
| `JWT_SECRET` | change-me-... | JWT 签名密钥（**必须修改**） |
| `LOG_LEVEL` | info | 日志级别 (debug/info/warn/error) |
| `FRONTEND_PORT` | 80 | Docker 前端映射端口 |
| `BACKEND_PORT` | 8000 | Docker 后端映射端口 |

完整示例见 `.env.example`。

---

## 安全配置

### 必做事项

1. **修改 JWT_SECRET**
   ```bash
   # 生成随机密钥
   openssl rand -hex 32
   # 写入 .env
   JWT_SECRET=your-generated-key
   ```

2. **修改默认密码**
   - 首次登录后立即修改 admin 密码
   - 默认账号: `admin` / `password`

3. **配置 HTTPS**（生产环境）
   - 使用 Nginx + Let's Encrypt
   - 或使用 Cloudflare 代理

### 建议事项

- 配置防火墙，仅开放必要端口 (80, 443)
- 定期更新依赖: `npm audit fix`
- 限制文件上传大小
- 定期备份 `backend-data` volume

---

## 常见问题

### Q: 后端启动报错 `better-sqlite3` 编译失败

```bash
cd nettools-backend-node
npm rebuild better-sqlite3
# 如果仍然失败，安装构建工具
apt-get install python3 make g++
```

### Q: Docker 容器无法连接 GitHub

容器内网络配置问题，检查 DNS 或代理设置：
```bash
docker-compose exec backend curl -sI https://github.com
```

### Q: 前端空白页面

检查 nginx.conf 中 API 代理是否正确指向 backend 容器：
```bash
docker-compose exec frontend cat /etc/nginx/conf.d/default.conf
```

### Q: WebSocket 连接失败

确保 nginx 配置了 WebSocket 代理（`Upgrade` 和 `Connection` header）。

### Q: 忘记管理员密码

删除数据库重新初始化：
```bash
# Docker
docker-compose down
docker volume rm nettools_backend-data
docker-compose up -d

# 传统部署
rm nettools-backend-node/data/nettools.db
npm start
```
