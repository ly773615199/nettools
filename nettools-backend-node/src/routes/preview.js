/**
 * 文件预览路由 — 文本/图片/PDF/Markdown/Office 预览 + 原始文件下载
 */
const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');
const { authMiddleware } = require('../core/auth');

// Office 转 PDF 缓存目录
const OFFICE_CACHE_DIR = path.join(__dirname, '..', '..', '.preview-cache');
if (!fs.existsSync(OFFICE_CACHE_DIR)) {
  fs.mkdirSync(OFFICE_CACHE_DIR, { recursive: true });
}

/**
 * 检测 LibreOffice 是否可用
 */
function hasLibreOffice() {
  try {
    execSync('which libreoffice 2>/dev/null || which soffice 2>/dev/null', { encoding: 'utf8' }).trim();
    return true;
  } catch {
    return false;
  }
}

/**
 * 将 Office 文档转换为 PDF（异步）
 */
function convertToPdf(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    exec(
      `libreoffice --headless --norestore --convert-to pdf --outdir "${path.dirname(outputPath)}" "${inputPath}"`,
      { timeout: 30000 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(`LibreOffice conversion failed: ${err.message}`));
        // 输出文件名由 LibreOffice 决定（同名 .pdf）
        const expectedPdf = path.join(path.dirname(outputPath), path.basename(inputPath, path.extname(inputPath)) + '.pdf');
        if (fs.existsSync(expectedPdf)) {
          // 重命名为缓存文件名
          fs.renameSync(expectedPdf, outputPath);
        }
        resolve(outputPath);
      }
    );
  });
}

function registerPreviewRoutes(app) {
  // 统一驱动查找
  function findDriver(driverOrStorageId) {
    const storageManager = require('../services/storageManager');
    const smDriver = storageManager.getDriver(driverOrStorageId);
    if (smDriver) return smDriver;
    const legacyDrivers = require('../drivers/storageApi').drivers;
    return legacyDrivers.get(driverOrStorageId) || null;
  }

  // 文本预览
  app.get('/api/preview', authMiddleware, async (req, res) => {
    try {
      const { driver: driverId = 'local', path: filePath } = req.query;
      if (!filePath) return res.status(400).json({ error: 'path is required' });

      const driver = findDriver(driverId);
      if (!driver) return res.status(400).json({ error: 'Unknown driver or storage not enabled' });

      const ext = path.extname(filePath).toLowerCase();
      const textExts = ['.txt', '.js', '.ts', '.json', '.css', '.html', '.xml', '.yaml', '.yml', '.sh', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.log', '.conf', '.cfg', '.ini', '.env'];
      const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico'];
      const officeExts = ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp'];

      // Markdown 预览（前端渲染）
      if (ext === '.md' || ext === '.markdown') {
        const result = await driver.readFile(filePath);
        return res.json({ data: { type: 'markdown', content: result.data, meta: result.meta } });
      }

      // 纯文本预览
      if (textExts.includes(ext)) {
        const result = await driver.readFile(filePath);
        return res.json({ data: { type: 'text', content: result.data, meta: result.meta } });
      }

      // 图片预览
      if (imageExts.includes(ext)) {
        return res.json({
          data: { type: 'image', previewUrl: `/api/storage/raw?driver=${encodeURIComponent(driverId)}&path=${encodeURIComponent(filePath)}` },
        });
      }

      // PDF 预览
      if (ext === '.pdf') {
        return res.json({
          data: { type: 'pdf', previewUrl: `/api/storage/raw?driver=${encodeURIComponent(driverId)}&path=${encodeURIComponent(filePath)}` },
        });
      }

      // Office 文档预览（需要 LibreOffice）
      if (officeExts.includes(ext)) {
        if (!hasLibreOffice()) {
          const info = await driver.info(filePath);
          return res.json({
            data: {
              type: 'office_unavailable',
              name: info.data.name,
              size: info.data.size,
              message: 'LibreOffice not installed. Install it to enable Office document preview.',
              downloadUrl: `/api/storage/raw?driver=${encodeURIComponent(driverId)}&path=${encodeURIComponent(filePath)}`,
            },
          });
        }

        // 检查缓存
        const cacheKey = Buffer.from(`${driverId}:${filePath}`).toString('base64url');
        const cachedPdf = path.join(OFFICE_CACHE_DIR, `${cacheKey}.pdf`);
        const metaPath = path.join(OFFICE_CACHE_DIR, `${cacheKey}.meta.json`);

        // 如果有缓存且文件未变化
        if (fs.existsSync(cachedPdf) && fs.existsSync(metaPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            const info = await driver.info(filePath);
            if (meta.size === info.data.size && meta.mtime === info.data.modified) {
              return res.json({
                data: {
                  type: 'pdf',
                  previewUrl: `/api/preview/cache/${cacheKey}.pdf`,
                  cached: true,
                },
              });
            }
          } catch { /* 缓存元数据无效，重新转换 */ }
        }

        // 下载文件到本地并转换
        try {
          const tempPath = path.join(OFFICE_CACHE_DIR, `temp_${Date.now()}${ext}`);
          if (driver._safePath) {
            // 本地文件，直接用原始路径
            const fullPath = driver._safePath(filePath);
            await convertToPdf(fullPath, cachedPdf);
          } else {
            // 远程文件，先下载
            const linkResult = await driver.link(filePath);
            const downloadUrl = linkResult.data.url;
            execSync(`curl -sL -o "${tempPath}" "${downloadUrl}"`, { timeout: 30000 });
            await convertToPdf(tempPath, cachedPdf);
            fs.unlinkSync(tempPath);
          }

          // 保存缓存元数据
          const info = await driver.info(filePath);
          fs.writeFileSync(metaPath, JSON.stringify({
            size: info.data.size,
            mtime: info.data.modified,
            convertedAt: new Date().toISOString(),
          }));

          return res.json({
            data: {
              type: 'pdf',
              previewUrl: `/api/preview/cache/${cacheKey}.pdf`,
              cached: false,
            },
          });
        } catch (convErr) {
          return res.status(500).json({ error: `Office conversion failed: ${convErr.message}` });
        }
      }

      const info = await driver.info(filePath);
      res.json({
        data: {
          type: 'binary',
          name: info.data.name,
          size: info.data.size,
          downloadUrl: `/api/storage/raw?driver=${encodeURIComponent(driverId)}&path=${encodeURIComponent(filePath)}`,
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 原始文件下载（支持 Range）
  app.get('/api/storage/raw', authMiddleware, async (req, res) => {
    try {
      const { driver: driverId = 'local', path: filePath } = req.query;
      if (!filePath) return res.status(400).json({ error: 'path is required' });

      const driver = findDriver(driverId);
      if (!driver) return res.status(400).json({ error: 'Unknown driver or storage not enabled' });

      if (driver._safePath) {
        const fullPath = driver._safePath(filePath);
        if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'File not found' });
        const stats = fs.statSync(fullPath);
        const ext = path.extname(fullPath).toLowerCase();
        const mimeMap = {
          '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
          '.json': 'application/json', '.xml': 'application/xml',
          '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
          '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
          '.pdf': 'application/pdf', '.zip': 'application/zip',
          '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
          '.txt': 'text/plain', '.md': 'text/markdown',
        };
        res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(path.basename(fullPath))}"`);
        fs.createReadStream(fullPath).pipe(res);
      } else {
        const linkResult = await driver.link(filePath);
        res.redirect(linkResult.data.url);
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Office 预览缓存文件服务
  app.get('/api/preview/cache/:filename', authMiddleware, (req, res) => {
    try {
      const filePath = path.join(OFFICE_CACHE_DIR, req.params.filename);
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Cached file not found' });
      const stats = fs.statSync(filePath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = { registerPreviewRoutes };
