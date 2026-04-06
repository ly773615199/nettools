import React from 'react';

interface ConnectionItemProps {
  id: string;
  host: string;
  srcIP: string;
  dstPort: string;
  chains: string[];
  rule: string;
  download: number;
  upload: number;
  start: string;
  onClose?: (id: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDuration(start: string): string {
  const ms = Date.now() - new Date(start).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m${s % 60}s`;
  return `${Math.floor(m / 60)}h${m % 60}m`;
}

export const ConnectionItem: React.FC<ConnectionItemProps> = ({
  id, host, srcIP, dstPort, chains, rule, download, upload, start, onClose,
}) => {
  return (
    <div style={{
      padding: '10px 16px',
      borderBottom: '1px solid #f0f0f0',
      display: 'grid',
      gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto',
      alignItems: 'center',
      gap: 8,
      fontSize: 13,
    }}>
      <div>
        <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{host || '—'}</div>
        <div style={{ fontSize: 11, color: '#999' }}>{srcIP}:{dstPort}</div>
      </div>
      <div style={{ fontSize: 12, color: '#666' }}>{chains[0] || '—'}</div>
      <div style={{ fontSize: 12, color: '#1976d2' }}>{rule}</div>
      <div style={{ fontSize: 12, color: '#4caf50' }}>↓ {formatBytes(download)}</div>
      <div style={{ fontSize: 12, color: '#ff9800' }}>↑ {formatBytes(upload)}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#999' }}>{formatDuration(start)}</span>
        <button
          onClick={() => onClose?.(id)}
          style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 4,
            border: '1px solid #f44336', color: '#f44336', background: '#fff', cursor: 'pointer',
          }}
        >
          关闭
        </button>
      </div>
    </div>
  );
};

interface ConnectionTableProps {
  connections: Array<{
    id: string;
    metadata: { host: string; srcIP: string; dstPort: string };
    chains: string[];
    rule: string;
    download: number;
    upload: number;
    start: string;
  }>;
  onClose?: (id: string) => void;
}

export const ConnectionTable: React.FC<ConnectionTableProps> = ({ connections, onClose }) => {
  return (
    <div>
      <div style={{
        padding: '8px 16px',
        background: '#f5f5f5',
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto',
        gap: 8,
        fontSize: 12,
        fontWeight: 600,
        color: '#666',
        borderRadius: '8px 8px 0 0',
      }}>
        <span>目标</span>
        <span>代理链</span>
        <span>规则</span>
        <span>下载</span>
        <span>上传</span>
        <span>时长</span>
      </div>
      {connections.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#999' }}>暂无活跃连接</div>
      ) : (
        connections.map((conn) => (
          <ConnectionItem
            key={conn.id}
            id={conn.id}
            host={conn.metadata.host}
            srcIP={conn.metadata.srcIP}
            dstPort={conn.metadata.dstPort}
            chains={conn.chains}
            rule={conn.rule}
            download={conn.download}
            upload={conn.upload}
            start={conn.start}
            onClose={onClose}
          />
        ))
      )}
    </div>
  );
};
