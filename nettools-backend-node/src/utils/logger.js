/**
 * Winston 日志系统
 * 分级日志 + 文件轮转
 */
const winston = require('winston');
const path = require('path');
const fs = require('fs');

const LOG_DIR = path.join(__dirname, '..', '..', 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // 控制台输出
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      ),
    }),
    // 文件输出 - 所有日志
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
    }),
    // 文件输出 - 仅错误
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 3,
      tailable: true,
    }),
  ],
});

// Express 请求日志中间件
function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const msg = `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;
    if (res.statusCode >= 500) {
      logger.error(msg);
    } else if (res.statusCode >= 400) {
      logger.warn(msg);
    } else {
      logger.info(msg);
    }
  });
  next();
}

// 获取最近日志
function getRecentLogs(lines = 100) {
  try {
    const logFile = path.join(LOG_DIR, 'combined.log');
    if (!fs.existsSync(logFile)) return [];
    const content = fs.readFileSync(logFile, 'utf8');
    return content.split('\n').filter(Boolean).slice(-lines);
  } catch {
    return [];
  }
}

module.exports = { logger, requestLogger, getRecentLogs, LOG_DIR };
