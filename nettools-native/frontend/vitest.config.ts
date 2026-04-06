import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom', // 使用jsdom模拟浏览器环境
    globals: true,
  },
});
