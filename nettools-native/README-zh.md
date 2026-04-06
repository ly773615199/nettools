# NetTools

一个综合性网络工具，将文件管理、隧道服务和代理服务集成到单个应用中。

## 功能特性

- **文件管理**：轻松管理不同存储服务中的文件。高效上传、下载和组织文件。
- **网络工具**：创建和管理用于端口转发的TCP隧道，以及用于网络优化的代理服务。
- **设置**：配置系统设置，管理存储服务，自定义NetTools体验。

## 项目结构

```
nettools-native/
├── frontend/            # React前端应用
│   ├── src/
│   │   ├── core/        # 核心服务和工具
│   │   │   ├── config/  # 配置服务
│   │   │   ├── network/ # 网络服务（Bore, Clash）
│   │   │   ├── storage/ # 存储服务（OpenList）
│   │   │   └── types/   # 类型定义
│   │   ├── pages/       # 页面React组件
│   │   │   ├── HomePage.tsx
│   │   │   ├── FileManagementPage.tsx
│   │   │   ├── NetworkToolsPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   ├── App.tsx      # 主应用组件
│   │   └── main.tsx     # 应用入口点
│   ├── package.json     # 前端依赖
│   └── tsconfig.json    # TypeScript配置
└── README.md           # 项目文档
```

## 开始使用

### 前提条件

- Node.js (v18+)
- npm (v9+)

### 安装

1. 克隆仓库：

```bash
git clone <repository-url>
cd nettools-native/frontend
```

2. 安装依赖：

```bash
npm install
```

### 开发

启动开发服务器：

```bash
npm run dev
```

应用将在 `http://localhost:5173` 可用。

### 生产构建

构建生产版本：

```bash
npm run build
```

构建文件将在 `dist` 目录中。

## 核心服务

### OpenList服务

- **描述**：一个文件管理服务，允许用户管理不同存储服务中的文件。
- **功能**：上传、下载、列出、删除和组织文件。

### Bore服务

- **描述**：一个用于端口转发的TCP隧道服务。
- **功能**：创建、启动、停止和删除隧道。

### Clash服务

- **描述**：一个用于网络优化的代理服务。
- **功能**：管理代理连接，测试代理性能，配置代理设置。

## 技术栈

- **前端**：React 19, TypeScript, Material UI 7
- **路由**：React Router
- **数据管理**：React Query
- **样式**：Material UI
- **构建工具**：Vite

## 许可证

MIT
