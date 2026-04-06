/**
 * 日志查看页面 — 对标 Clash Verge Rev 的 Logs 页面
 * 实时 Clash 运行日志
 */
import React, { useState, useEffect, useRef } from 'react';

interface LogEntry {
  type: 'info' | 'warning' | 'error' | 'debug';
  payload: string;
  time?: string;
}

const LOG_COLORS: Record<string, string> = {
  info: '#1976d2',
  warning: '#ff9800',
  error: '#f44336',
  debug: '#999',
};

const LOG_BG: Record<string, string> = {
  info: '#fff',
  warning: '#fff8e1',
  error: '#ffebee',
  debug: '#fafafa',
};

export const LogsPage: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  // 模拟从 WebSocket 或 API 获取日志
  // 实际应该对接 mihomo 的 WebSocket 日志端点
  useEffect(() => {
    // 尝试连接 mihomo 日志 WebSocket
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket('ws://127.0.0.1:9090/logs');
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLogs(prev => {
            const next = [...prev, { type: data.type || 'info', payload: data.payload || '', time: new Date().toISOString() }];
            return next.slice(-500); // 保留最新 500 条
          });
        } catch {}
      };
      ws.onerror = () => {
        // WebSocket 不可用时添加提示日志
        setLogs([{
          type: 'warning',
          payload: 'WebSocket 日志连接不可用，请确保 Clash (mihomo) 正在运行',
          time: new Date().toISOString(),
        }]);
      };
    } catch {
      setLogs([{
        type: 'info',
        payload: '日志页面就绪，等待 Clash 启动后自动连接',
        time: new Date().toISOString(),
      }]);
    }

    return () => { ws?.close(); };
  }, []);

  // 自动滚动
  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filtered = logs.filter(log => {
    if (levelFilter !== 'all' && log.type !== levelFilter) return false;
    if (filter && !log.payload.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  const handleClear = () => setLogs([]);
  const handleExport = () => {
    const text = filtered.map(l => `[${l.time || ''}] [${l.type.toUpperCase()}] ${l.payload}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clash-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>📋 运行日志</h2>
        <span style={{ fontSize: 13, color: '#999' }}>{filtered.length} 条</span>
      </div>

      {/* 工具栏 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' }}>
        <input
          placeholder="搜索日志内容"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14 }}
        />
        <select
          value={levelFilter}
          onChange={e => setLevelFilter(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14 }}
        >
          <option value="all">全部级别</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
          <option value="debug">Debug</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} />
          自动滚动
        </label>
        <button onClick={handleExport}
          style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
          导出
        </button>
        <button onClick={handleClear}
          style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #f44336', color: '#f44336', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
          清空
        </button>
      </div>

      {/* 日志内容 */}
      <div
        ref={logRef}
        style={{
          flex: 1,
          border: '1px solid #e0e0e0',
          borderRadius: 8,
          overflow: 'auto',
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        {filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#999' }}>
            暂无日志
          </div>
        ) : (
          filtered.map((log, i) => (
            <div
              key={i}
              style={{
                padding: '4px 12px',
                borderBottom: '1px solid #f5f5f5',
                background: LOG_BG[log.type] || '#fff',
                display: 'flex',
                gap: 8,
              }}
            >
              <span style={{ color: '#bbb', whiteSpace: 'nowrap', fontSize: 11 }}>
                {log.time ? new Date(log.time).toLocaleTimeString() : ''}
              </span>
              <span style={{
                color: LOG_COLORS[log.type] || '#333',
                fontWeight: log.type === 'error' ? 600 : 400,
                textTransform: 'uppercase',
                fontSize: 11,
                minWidth: 50,
              }}>
                {log.type}
              </span>
              <span style={{ color: '#333', wordBreak: 'break-all' }}>{log.payload}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LogsPage;
