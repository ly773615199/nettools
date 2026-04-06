/**
 * 连接监控页面 — 对标 Clash Verge Rev 的 Connections 页面
 * 实时查看活跃连接、流量统计、关闭连接
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { mihomoService, type MihomoConnection } from '../core/network/mihomoService';
import { ConnectionTable } from '../components/connection/ConnectionTable';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export const ConnectionsPage: React.FC = () => {
  const [connections, setConnections] = useState<MihomoConnection[]>([]);
  const [downloadTotal, setDownloadTotal] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<'time' | 'download' | 'upload'>('time');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadConnections = useCallback(async () => {
    const resp = await mihomoService.getConnections();
    if (resp.data) {
      setConnections(resp.data.connections || []);
      setDownloadTotal(resp.data.downloadTotal || 0);
      setUploadTotal(resp.data.uploadTotal || 0);
    }
  }, []);

  useEffect(() => {
    loadConnections();
    intervalRef.current = setInterval(loadConnections, 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [loadConnections]);

  const handleClose = async (id: string) => {
    await mihomoService.closeConnection(id);
    loadConnections();
  };

  const handleCloseAll = async () => {
    if (!confirm('确认关闭所有连接？')) return;
    await mihomoService.closeAllConnections();
    loadConnections();
  };

  const filtered = connections.filter(c =>
    !filter || c.metadata?.host?.toLowerCase().includes(filter.toLowerCase()) ||
    c.metadata?.srcIP?.includes(filter) ||
    c.rule?.toLowerCase().includes(filter.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'download') return b.download - a.download;
    if (sortBy === 'upload') return b.upload - a.upload;
    return new Date(b.start).getTime() - new Date(a.start).getTime();
  });

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>🔗 连接监控</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 14, color: '#4caf50' }}>↓ {formatBytes(downloadTotal)}</span>
          <span style={{ fontSize: 14, color: '#ff9800' }}>↑ {formatBytes(uploadTotal)}</span>
          <span style={{ fontSize: 14, color: '#1976d2', fontWeight: 500 }}>{connections.length} 连接</span>
        </div>
      </div>

      {/* 工具栏 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <input
          placeholder="搜索连接 (主机/IP/规则)"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14 }}
        />
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as any)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14 }}
        >
          <option value="time">按时间排序</option>
          <option value="download">按下载排序</option>
          <option value="upload">按上传排序</option>
        </select>
        <button onClick={handleCloseAll}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #f44336', color: '#f44336', background: '#fff', cursor: 'pointer' }}>
          关闭全部
        </button>
        <button onClick={loadConnections}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1976d2', color: '#fff', cursor: 'pointer' }}>
          刷新
        </button>
      </div>

      {/* 连接列表 */}
      <ConnectionTable connections={sorted as any} onClose={handleClose} />
    </div>
  );
};

export default ConnectionsPage;
