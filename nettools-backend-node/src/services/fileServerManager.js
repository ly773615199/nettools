/**
 * 多协议文件访问服务管理器 [G1]
 * 支持 HTTP/WebDAV/FTP/SFTP 对外提供文件访问
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const runningServers = new Map(); // key -> { type, server, startTime, port }

/**
 * 启动 HTTP 文件服务
 */
function startHttpServer(config) {
  const { port, storageDir, auth, username, password } = config;
  const key = `http:${port}`;

  if (runningServers.has(key)) {
    throw new Error(`HTTP server already running on port ${port}`);
  }

  const server = http.createServer((req, res) => {
    // Basic auth
    if (auth && username) {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="NetTools FileServer"' });
        return res.end('Authentication required');
      }
      const decoded = Buffer.from(authHeader.split(' ')[1], 'base64').toString();
      const [user, pass] = decoded.split(':');
      if (user !== username || pass !== (password || '')) {
        res.writeHead(403);
        return res.end('Access denied');
      }
    }

    let urlPath = decodeURIComponent(req.url);
    const filePath = path.join(storageDir, urlPath);

    if (!filePath.startsWith(storageDir)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    fs.stat(filePath, (err, stats) => {
      if (err) {
        res.writeHead(404);
        return res.end('Not found');
      }

      if (stats.isDirectory()) {
        fs.readdir(filePath, (err, files) => {
          if (err) {
            res.writeHead(500);
            return res.end('Error reading directory');
          }
          const items = files.map(f => {
            const itemPath = path.join(filePath, f);
            try {
              const itemStat = fs.statSync(itemPath);
              return {
                name: f + (itemStat.isDirectory() ? '/' : ''),
                isDir: itemStat.isDirectory(),
                size: itemStat.size,
                mtime: itemStat.mtime,
              };
            } catch {
              return { name: f, isDir: false, size: 0, mtime: null };
            }
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            path: urlPath,
            items: items.map(i => ({
              name: i.name,
              isDir: i.isDir,
              size: i.size,
              modified: i.mtime,
            })),
          }));
        });
      } else {
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Length': stats.size,
          'Content-Disposition': `attachment; filename="${path.basename(filePath)}"`,
        });
        fs.createReadStream(filePath).pipe(res);
      }
    });
  });

  server.listen(port, () => {
    console.log(`[fileServer] HTTP server started on port ${port}, serving ${storageDir}`);
  });

  server.on('error', (err) => {
    console.error(`[fileServer] HTTP server error:`, err.message);
    runningServers.delete(key);
  });

  runningServers.set(key, {
    type: 'http',
    server,
    startTime: Date.now(),
    port,
    config,
  });

  return { key, port, url: `http://localhost:${port}` };
}

/**
 * 启动 WebDAV 文件服务
 */
function startWebdavServer(config) {
  const { port, storageDir, auth, username, password } = config;
  const key = `webdav:${port}`;

  if (runningServers.has(key)) {
    throw new Error(`WebDAV server already running on port ${port}`);
  }

  const server = http.createServer((req, res) => {
    // Basic auth
    if (auth && username) {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="NetTools WebDAV"' });
        return res.end('Authentication required');
      }
      const decoded = Buffer.from(authHeader.split(' ')[1], 'base64').toString();
      const [user, pass] = decoded.split(':');
      if (user !== username || pass !== (password || '')) {
        res.writeHead(403);
        return res.end('Access denied');
      }
    }

    let urlPath = decodeURIComponent(req.url);
    const filePath = path.join(storageDir, urlPath);

    if (!filePath.startsWith(storageDir)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    switch (req.method) {
      case 'PROPFIND':
        handlePropfind(req, res, filePath, storageDir, urlPath);
        break;
      case 'GET':
        handleGet(req, res, filePath);
        break;
      case 'PUT':
        handlePut(req, res, filePath);
        break;
      case 'MKCOL':
        handleMkcol(req, res, filePath);
        break;
      case 'DELETE':
        handleDelete(req, res, filePath);
        break;
      case 'MOVE':
        handleMove(req, res, filePath, storageDir);
        break;
      case 'COPY':
        handleCopy(req, res, filePath, storageDir);
        break;
      case 'OPTIONS':
        res.writeHead(200, {
          'DAV': '1, 2',
          'MS-Author-Via': 'DAV',
          'Allow': 'OPTIONS, GET, HEAD, POST, PUT, DELETE, COPY, MOVE, MKCOL, PROPFIND, PROPPATCH, LOCK, UNLOCK',
        });
        res.end();
        break;
      default:
        res.writeHead(405);
        res.end('Method not allowed');
    }
  });

  server.listen(port, () => {
    console.log(`[fileServer] WebDAV server started on port ${port}, serving ${storageDir}`);
  });

  server.on('error', (err) => {
    console.error(`[fileServer] WebDAV server error:`, err.message);
    runningServers.delete(key);
  });

  runningServers.set(key, {
    type: 'webdav',
    server,
    startTime: Date.now(),
    port,
    config,
  });

  return { key, port, url: `http://localhost:${port}` };
}

function handlePropfind(req, res, filePath, storageDir, urlPath) {
  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }

    let body = `<?xml version="1.0" encoding="utf-8"?>\n<D:multistatus xmlns:D="DAV:">`;

    if (stats.isDirectory()) {
      body += buildPropResponse(urlPath, true, 0, stats.mtime);
      fs.readdirSync(filePath).forEach(name => {
        try {
          const childStat = fs.statSync(path.join(filePath, name));
          body += buildPropResponse(
            urlPath.endsWith('/') ? urlPath + name : urlPath + '/' + name,
            childStat.isDirectory(),
            childStat.size,
            childStat.mtime
          );
        } catch {}
      });
    } else {
      body += buildPropResponse(urlPath, false, stats.size, stats.mtime);
    }

    body += '</D:multistatus>';
    res.writeHead(207, { 'Content-Type': 'application/xml; charset=utf-8' });
    res.end(body);
  });
}

function buildPropResponse(href, isDir, size, mtime) {
  return `
<D:response>
  <D:href>${href}</D:href>
  <D:propstat>
    <D:prop>
      <D:resourcetype>${isDir ? '<D:collection/>' : ''}</D:resourcetype>
      <D:getcontentlength>${size}</D:getcontentlength>
      <D:getlastmodified>${mtime ? mtime.toUTCString() : ''}</D:getlastmodified>
      <D:creationdate>${mtime ? mtime.toISOString() : ''}</D:creationdate>
    </D:prop>
    <D:status>HTTP/1.1 200 OK</D:status>
  </D:propstat>
</D:response>`;
}

function handleGet(req, res, filePath) {
  fs.stat(filePath, (err, stats) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    if (stats.isDirectory()) {
      fs.readdir(filePath, (err, files) => {
        if (err) { res.writeHead(500); return res.end('Error'); }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        const links = files.map(f => `<a href="${encodeURIComponent(f)}">${f}</a>`).join('<br>');
        res.end(`<h1>${req.url}</h1>${links}`);
      });
    } else {
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': stats.size,
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });
}

function handlePut(req, res, filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const ws = fs.createWriteStream(filePath);
  req.pipe(ws);
  ws.on('finish', () => { res.writeHead(201); res.end('Created'); });
  ws.on('error', () => { res.writeHead(500); res.end('Write error'); });
}

function handleMkcol(req, res, filePath) {
  fs.mkdir(filePath, { recursive: true }, (err) => {
    if (err) { res.writeHead(409); return res.end('Conflict'); }
    res.writeHead(201);
    res.end('Created');
  });
}

function handleDelete(req, res, filePath) {
  fs.stat(filePath, (err, stats) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const rm = stats.isDirectory() ? fs.rm : fs.unlink;
    rm.call(fs, filePath, { recursive: true }, (err) => {
      if (err) { res.writeHead(500); return res.end('Delete failed'); }
      res.writeHead(204);
      res.end();
    });
  });
}

function handleMove(req, res, filePath, storageDir) {
  const dest = req.headers.destination;
  if (!dest) { res.writeHead(400); return res.end('No destination'); }
  const destPath = path.join(storageDir, decodeURIComponent(new URL(dest).pathname));
  if (!destPath.startsWith(storageDir)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.mkdir(path.dirname(destPath), { recursive: true }, () => {
    fs.rename(filePath, destPath, (err) => {
      if (err) { res.writeHead(500); return res.end('Move failed'); }
      res.writeHead(201);
      res.end('Moved');
    });
  });
}

function handleCopy(req, res, filePath, storageDir) {
  const dest = req.headers.destination;
  if (!dest) { res.writeHead(400); return res.end('No destination'); }
  const destPath = path.join(storageDir, decodeURIComponent(new URL(dest).pathname));
  if (!destPath.startsWith(storageDir)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.mkdir(path.dirname(destPath), { recursive: true }, () => {
    fs.copyFile(filePath, destPath, (err) => {
      if (err) { res.writeHead(500); return res.end('Copy failed'); }
      res.writeHead(201);
      res.end('Copied');
    });
  });
}

/**
 * 停止文件服务
 */
function stopServer(key) {
  const entry = runningServers.get(key);
  if (!entry) throw new Error(`Server ${key} not found`);

  if (entry.server) {
    entry.server.close();
  }
  if (entry.process) {
    entry.process.kill('SIGTERM');
  }

  runningServers.delete(key);
  console.log(`[fileServer] Stopped ${key}`);
  return true;
}

/**
 * 获取所有运行中的服务状态
 */
function getServerStatus() {
  const status = [];
  for (const [key, entry] of runningServers) {
    status.push({
      key,
      type: entry.type,
      port: entry.port,
      uptime: Date.now() - entry.startTime,
      url: `http://localhost:${entry.port}`,
      config: {
        storageDir: entry.config.storageDir,
        auth: entry.config.auth || false,
      },
    });
  }
  return status;
}

module.exports = {
  startHttpServer,
  startWebdavServer,
  stopServer,
  getServerStatus,
  runningServers,
};
