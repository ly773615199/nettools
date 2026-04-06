# NetTools 服务集成文档

## 项目概述

NetTools 是一个综合性网络工具，将文件管理、隧道服务和代理服务集成到单个应用中。它以 OpenList 为核心，Bore 和 Clash 为辅助功能，为用户提供了一个统一的界面来管理文件、网络隧道和代理服务。

### 主要功能

- **文件管理**：通过 OpenList 服务，用户可以管理不同存储服务中的文件，支持上传、下载、删除、重命名等操作。
- **网络工具**：通过 Bore 服务，用户可以创建和管理 TCP 隧道，实现端口转发功能。
- **代理服务**：通过 Clash 服务，用户可以管理代理服务器，实现网络优化和安全访问。
- **系统设置**：用户可以配置系统语言、主题、自动启动等设置。

## 架构设计

### 前端架构

- **技术栈**：React 19 + TypeScript + Material UI 7
- **构建工具**：Vite 8
- **状态管理**：React Query
- **路由**：React Router
- **目录结构**：
  - `src/core/` - 核心服务和工具
  - `src/pages/` - 页面组件
  - `src/App.tsx` - 主应用组件
  - `src/main.tsx` - 应用入口

### 后端架构

- **技术栈**：Go 语言
- **Web 框架**：Gin
- **API 设计**：RESTful API
- **目录结构**：
  - `cmd/server/` - 服务器入口
  - `go.mod` - Go 模块依赖

### 服务集成

- **API 客户端**：前端通过 API 客户端与后端进行通信
- **认证机制**：使用 JWT 令牌进行认证
- **数据传输**：JSON 格式的数据传输
- **错误处理**：统一的错误处理机制

## 部署指南

### 前置条件

- Docker 和 Docker Compose 已安装
- Git 已安装

### 部署步骤

1. **克隆仓库**

   ```bash
   git clone <repository-url>
   cd alist_bore
   ```

2. **构建和启动服务**

   ```bash
   docker-compose up -d
   ```

3. **访问应用**

   打开浏览器，访问 `http://localhost` 即可访问 NetTools 应用。

### 服务配置

- **前端服务**：运行在端口 80，通过 Nginx 提供静态文件服务
- **后端服务**：运行在端口 8000，提供 RESTful API
- **网络**：通过 Docker 网络连接前端和后端服务

## API 文档

### 认证 API

- **POST /api/auth/login**：登录
  - 请求体：`{ "username": "admin", "password": "password" }`
  - 响应：`{ "token": "test-token", "user": { "id": "1", "username": "admin" } }`

- **POST /api/auth/register**：注册
  - 请求体：`{ "username": "user", "password": "password" }`
  - 响应：`{ "token": "test-token", "user": { "id": "2", "username": "user" } }`

- **POST /api/auth/logout**：注销
  - 响应：`{ "message": "Logout successful" }`

### 存储服务 API

- **GET /api/storage/list**：获取存储服务列表
- **POST /api/storage/create**：创建存储服务
- **PUT /api/storage/update**：更新存储服务
- **DELETE /api/storage/delete**：删除存储服务
- **POST /api/storage/enable**：启用存储服务
- **POST /api/storage/disable**：禁用存储服务

### 隧道服务 API

- **GET /api/tunnel/list**：获取隧道列表
- **POST /api/tunnel/create**：创建隧道
- **DELETE /api/tunnel/delete**：删除隧道
- **POST /api/tunnel/start**：启动隧道
- **POST /api/tunnel/stop**：停止隧道

### 代理服务 API

- **GET /api/proxy/list**：获取代理列表
- **POST /api/proxy/create**：创建代理
- **DELETE /api/proxy/delete**：删除代理
- **POST /api/proxy/connect**：连接代理
- **POST /api/proxy/disconnect**：断开代理

## 使用说明

### 登录

1. 打开 NetTools 应用
2. 点击登录按钮
3. 输入用户名和密码（默认：admin/password）
4. 点击登录

### 文件管理

1. 登录后，点击左侧导航栏的"文件管理"
2. 在存储服务标签页中，点击"添加存储服务"
3. 选择存储类型，填写配置信息
4. 点击"保存"按钮
5. 在文件浏览器标签页中，选择存储服务，浏览和管理文件

### 网络工具

1. 登录后，点击左侧导航栏的"网络工具"
2. 在隧道标签页中，点击"添加隧道"
3. 填写隧道信息（本地端口、远程服务器、远程端口）
4. 点击"保存"按钮
5. 点击"启动"按钮启动隧道
6. 在代理标签页中，点击"添加代理"
7. 填写代理信息（服务器、端口、类型等）
8. 点击"保存"按钮
9. 点击"连接"按钮连接代理

### 系统设置

1. 登录后，点击左侧导航栏的"设置"
2. 在通用设置中，设置语言、主题、自动启动等
3. 在存储服务设置中，管理存储服务
4. 点击"保存"按钮保存设置

## 故障排除

### 服务无法启动

- 检查 Docker 是否运行
- 检查端口是否被占用
- 查看 Docker 日志：`docker-compose logs`

### 前端无法连接后端

- 检查后端服务是否运行：`docker-compose ps`
- 检查网络连接：`docker network inspect alist_bore_nettools-network`
- 检查 API 端点：`curl http://localhost:8000/health`

### 存储服务无法连接

- 检查存储服务配置是否正确
- 检查网络连接
- 查看后端日志：`docker-compose logs backend`

## 开发指南

### 前端开发

1. 进入前端目录：`cd nettools-native/frontend`
2. 安装依赖：`npm install`
3. 启动开发服务器：`npm run dev`
4. 构建生产版本：`npm run build`
5. 运行测试：`npm test`

### 后端开发

1. 进入后端目录：`cd nettools-backend`
2. 安装依赖：`go mod download`
3. 运行开发服务器：`go run cmd/server/main.go`
4. 构建生产版本：`go build -o server ./cmd/server`

## 安全注意事项

- 生产环境中应使用强密码
- 应配置 HTTPS
- 应限制 API 访问权限
- 应定期更新依赖包

## 未来计划

- 支持更多存储服务
- 支持更多隧道类型
- 支持更多代理协议
- 添加用户权限管理
- 优化性能和用户体验

## 联系方式

如有问题或建议，请联系项目维护者。
