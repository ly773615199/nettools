/**
 * 通用中间件集合
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const { requestLogger } = require('../utils/logger');

/**
 * 注册全局中间件
 */
function registerMiddleware(app) {
  // CORS
  app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    headers: ['Origin', 'Content-Type', 'Accept', 'Authorization'],
    credentials: true
  }));

  // Session
  app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 15,
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true
    }
  }));

  // Body parser
  app.use(express.json());

  // Security headers
  app.use(helmet());

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  // Request logging
  app.use(requestLogger);
}

/**
 * 注册错误处理中间件（需在所有路由之后调用）
 */
function registerErrorHandlers(app) {
  // 404
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // 500
  app.use((err, req, res, _next) => {
    console.error(`[Error] ${req.method} ${req.url} — ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  });
}

module.exports = { registerMiddleware, registerErrorHandlers };
