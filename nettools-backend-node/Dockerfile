FROM node:20-slim

# better-sqlite3 使用 N-API 预编译，无需 python/make/g++
# 仅需 curl 用于 healthcheck
RUN apt-get update && apt-get install -y curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 先复制 package 文件并安装依赖（利用 Docker 缓存）
COPY package*.json ./
RUN npm ci --production

# 复制源码
COPY . .

# 创建必要目录
RUN mkdir -p /app/data /app/downloads /app/uploads

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["node", "src/index.js"]
