# 部署文档

## 目录

- [简介](#简介)
- [前提条件](#前提条件)
- [后端服务部署](#后端服务部署)
- [前端应用部署](#前端应用部署)
- [使用 Docker Compose 部署](#使用-docker-compose-部署)
- [环境变量配置](#环境变量配置)
- [安全配置](#安全配置)
- [常见问题及解决方案](#常见问题及解决方案)

## 简介

本部署文档旨在指导用户如何部署和使用网络工具软件。该软件以 OpenList 为核心，Bore 和 Clash 为辅助功能，提供了文件管理、网络工具管理等功能。

## 前提条件

在部署之前，确保您的系统满足以下要求：

- Node.js 20 或更高版本
- npm 或 yarn 包管理器
- Docker 和 Docker Compose（如果使用容器化部署）
- 足够的磁盘空间和内存

## 后端服务部署

### 1. 克隆仓库

```bash
git clone <repository-url>
cd <repository-directory>
```

### 2. 安装依赖

```bash
cd nettools-backend-node
npm install
```

### 3. 配置环境变量

创建 `.env` 文件，并添加以下配置：

```env
# 服务器配置
PORT=8000
NODE_ENV=production

# JWT 密钥
JWT_SECRET=your-secret-key

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_NAME=nettools
DB_USER=root
DB_PASSWORD=password
```

### 4. 运行数据库迁移和种子数据

```bash
# 运行数据库迁移
npx sequelize-cli db:migrate

# 运行种子数据
npx sequelize-cli db:seed:all
```

### 5. 启动后端服务

```bash
npm start
```

后端服务将在 `http://localhost:8000` 上运行。

## 前端应用部署

### 1. 安装依赖

```bash
cd nettools-native/frontend
npm install
```

### 2. 构建应用

```bash
npm run build
```

### 3. 部署构建结果

将 `dist` 目录中的文件部署到您的 Web 服务器（如 Nginx、Apache 等）。

### 4. 配置 Nginx

如果使用 Nginx 作为 Web 服务器，创建以下配置文件：

```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        root /path/to/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 使用 Docker Compose 部署

### 1. 配置环境变量

创建 `.env` 文件，并添加以下配置：

```env
# 服务器配置
PORT=8000
NODE_ENV=production

# JWT 密钥
JWT_SECRET=your-secret-key
```

### 2. 构建和运行容器

```bash
docker-compose build
docker-compose up -d
```

前端应用将在 `http://localhost` 上运行，后端服务将在 `http://localhost:8000` 上运行。

## 环境变量配置

| 变量名 | 描述 | 默认值 |
|-------|------|-------|
| `PORT` | 后端服务端口 | 8000 |
| `NODE_ENV` | 运行环境 | development |
| `JWT_SECRET` | JWT 密钥 | your-secret-key |
| `DB_HOST` | 数据库主机 | localhost |
| `DB_PORT` | 数据库端口 | 3306 |
| `DB_NAME` | 数据库名称 | nettools |
| `DB_USER` | 数据库用户 | root |
| `DB_PASSWORD` | 数据库密码 | password |

## 安全配置

### 1. 更改默认密码

在首次部署后，登录系统并更改默认管理员密码。

### 2. 配置 HTTPS

在生产环境中，建议配置 HTTPS 以提高安全性。

### 3. 配置防火墙

配置防火墙，只允许必要的端口访问。

### 4. 定期更新依赖

定期更新依赖，以修复安全漏洞。

## 常见问题及解决方案

### 1. 后端服务启动失败

**问题**：后端服务启动失败，显示端口被占用。

**解决方案**：检查端口 8000 是否被其他进程占用，如有必要，修改 `.env` 文件中的 `PORT` 变量。

### 2. 数据库连接失败

**问题**：后端服务无法连接到数据库。

**解决方案**：检查数据库配置是否正确，确保数据库服务正在运行。

### 3. 前端应用无法访问后端 API

**问题**：前端应用无法访问后端 API，显示跨域错误。

**解决方案**：确保后端服务的 CORS 配置正确，允许前端应用的域名访问。

### 4. 登录失败

**问题**：用户无法登录，显示验证码错误。

**解决方案**：确保验证码正确输入，并且会话管理正常工作。

### 5. 文件上传失败

**问题**：文件上传失败，显示服务器错误。

**解决方案**：检查文件上传目录的权限，确保服务器有写权限。
