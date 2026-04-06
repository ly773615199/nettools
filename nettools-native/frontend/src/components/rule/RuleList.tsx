import React from 'react';

interface RuleItemProps {
  lineNo: number;
  type: string;
  payload: string;
  proxy: string;
}

export const RuleItem: React.FC<RuleItemProps> = ({ lineNo, type, payload, proxy }) => {
  const typeColor: Record<string, string> = {
    'DOMAIN-SUFFIX': '#1976d2',
    'DOMAIN-KEYWORD': '#2196f3',
    'DOMAIN': '#42a5f5',
    'IP-CIDR': '#4caf50',
    'IP-CIDR6': '#66bb6a',
    'GEOIP': '#ff9800',
    'PROCESS-NAME': '#9c27b0',
    'MATCH': '#f44336',
  };

  return (
    <div style={{
      padding: '6px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      fontSize: 13,
      borderBottom: '1px solid #f5f5f5',
    }}>
      <span style={{ width: 32, textAlign: 'right', color: '#bbb', fontSize: 12 }}>{lineNo}</span>
      <span style={{
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 500,
        color: '#fff',
        background: typeColor[type] || '#999',
        minWidth: 100,
        textAlign: 'center',
      }}>
        {type}
      </span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#333' }}>
        {payload}
      </span>
      <span style={{
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 12,
        background: proxy === 'DIRECT' ? '#e8f5e9' : proxy === 'REJECT' ? '#ffebee' : '#e3f2fd',
        color: proxy === 'DIRECT' ? '#4caf50' : proxy === 'REJECT' ? '#f44336' : '#1976d2',
      }}>
        {proxy}
      </span>
    </div>
  );
};

interface RuleListProps {
  rules: Array<{ type: string; payload: string; proxy: string }>;
  filter?: string;
}

export const RuleList: React.FC<RuleListProps> = ({ rules, filter }) => {
  const filtered = filter
    ? rules.filter(r => r.payload?.toLowerCase().includes(filter.toLowerCase()) || r.type?.toLowerCase().includes(filter.toLowerCase()))
    : rules;

  return (
    <div style={{ border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{
        padding: '8px 16px',
        background: '#f5f5f5',
        display: 'flex',
        gap: 12,
        fontSize: 12,
        fontWeight: 600,
        color: '#666',
      }}>
        <span style={{ width: 32, textAlign: 'right' }}>#</span>
        <span style={{ minWidth: 100, textAlign: 'center' }}>类型</span>
        <span style={{ flex: 1 }}>匹配值</span>
        <span>代理</span>
      </div>
      {filtered.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#999' }}>暂无规则</div>
      ) : (
        filtered.map((rule, i) => (
          <RuleItem key={i} lineNo={i + 1} type={rule.type} payload={rule.payload} proxy={rule.proxy} />
        ))
      )}
      <div style={{ padding: '6px 16px', background: '#fafafa', fontSize: 12, color: '#999', textAlign: 'center' }}>
        共 {filtered.length} 条规则
      </div>
    </div>
  );
};
