import React, { useState } from 'react';

interface ProxyNodeProps {
  name: string;
  type: string;
  delay?: number;
  selected?: boolean;
  onSelect?: () => void;
  onTest?: () => void;
}

export const ProxyNode: React.FC<ProxyNodeProps> = ({ name, type, delay, selected, onSelect, onTest }) => {
  const delayColor = !delay ? '#999' : delay < 200 ? '#4caf50' : delay < 500 ? '#ff9800' : '#f44336';

  return (
    <div
      onClick={onSelect}
      style={{
        padding: '8px 12px',
        margin: '4px 0',
        borderRadius: 8,
        border: selected ? '2px solid #1976d2' : '1px solid #e0e0e0',
        background: selected ? '#e3f2fd' : '#fff',
        cursor: onSelect ? 'pointer' : 'default',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        transition: 'all 0.2s',
      }}
    >
      <div>
        <span style={{ fontWeight: selected ? 600 : 400, fontSize: 14 }}>{name}</span>
        <span style={{ marginLeft: 8, fontSize: 12, color: '#888', background: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>{type}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {delay !== undefined && (
          <span style={{ fontSize: 13, color: delayColor, fontWeight: 500 }}>{delay}ms</span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onTest?.(); }}
          style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, border: '1px solid #ddd', background: '#fafafa', cursor: 'pointer' }}
        >
          测速
        </button>
      </div>
    </div>
  );
};

interface ProxyGroupCardProps {
  name: string;
  type: string;
  now: string;
  all: string[];
  onSelect: (proxy: string) => void;
  onTest?: () => void;
}

export const ProxyGroupCard: React.FC<ProxyGroupCardProps> = ({ name, type, now, all, onSelect, onTest }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ border: '1px solid #e0e0e0', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '12px 16px',
          background: '#fafafa',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
        }}
      >
        <div>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{name}</span>
          <span style={{ marginLeft: 8, fontSize: 12, color: '#888' }}>{type}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#1976d2', fontWeight: 500 }}>{now}</span>
          <span style={{ fontSize: 18, color: '#999', transform: expanded ? 'rotate(180deg)' : '', transition: 'transform 0.2s' }}>▼</span>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '8px 16px 12px' }}>
          {all.map((proxy) => (
            <ProxyNode
              key={proxy}
              name={proxy}
              type=""
              selected={proxy === now}
              onSelect={() => onSelect(proxy)}
              onTest={onTest}
            />
          ))}
        </div>
      )}
    </div>
  );
};
