/**
 * 订阅管理页面 — 对标 Clash Verge Rev 的 Profiles 页面
 * 导入订阅、查看节点数、手动/自动更新
 */
import React, { useState, useEffect, useCallback } from 'react';
import { subscriptionService, type Subscription } from '../core/network/subscriptionService';
import { mihomoService } from '../core/network/mihomoService';
import { ProxyGroupCard } from '../components/proxy/ProxyGroupCard';

export const ProfilesPage: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [proxies, setProxies] = useState<Record<string, any>>({});
  const [msg, setMsg] = useState('');

  const loadSubs = useCallback(async () => {
    const resp = await subscriptionService.getSubscriptions();
    if (resp.data) setSubscriptions(resp.data);
  }, []);

  const loadProxies = useCallback(async () => {
    const resp = await mihomoService.getProxies();
    if (resp.data?.proxies) setProxies(resp.data.proxies);
  }, []);

  useEffect(() => { loadSubs(); loadProxies(); }, []);

  const handlePreview = async () => {
    if (!newUrl) return;
    setLoading(true);
    const resp = await subscriptionService.previewSubscription(newUrl);
    setLoading(false);
    if (resp.data) setPreview(resp.data);
    else setMsg(resp.error || '预览失败');
  };

  const handleAdd = async () => {
    if (!newUrl || !newName) return;
    setLoading(true);
    const resp = await subscriptionService.createSubscription({
      name: newName,
      url: newUrl,
      autoUpdate: true,
      updateInterval: 86400,
    });
    setLoading(false);
    if (resp.data) {
      setMsg(`✅ 导入成功: ${resp.data.proxyCount} 个节点`);
      setShowAdd(false);
      setNewUrl('');
      setNewName('');
      setPreview(null);
      loadSubs();
      loadProxies();
    } else {
      setMsg(`❌ ${resp.error}`);
    }
  };

  const handleUpdate = async (id: number) => {
    setMsg('更新中...');
    const resp = await subscriptionService.updateSubscription(id);
    if (resp.data) {
      setMsg(`✅ ${resp.data.proxyCount} 个节点已更新`);
      loadSubs();
      loadProxies();
    } else {
      setMsg(`❌ ${resp.error}`);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除此订阅？')) return;
    await subscriptionService.deleteSubscription(id);
    loadSubs();
  };

  const handleSelectProxy = async (group: string, proxy: string) => {
    await mihomoService.selectProxy(group, proxy);
    loadProxies();
  };

  // 获取代理组 (type 为 select/url-test/fallback/load-balance 的节点)
  const groups = Object.entries(proxies).filter(
    ([_, p]: any) => p.all && p.all.length > 0
  );

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>📦 订阅管理</h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          style={{
            padding: '8px 20px', borderRadius: 8, border: 'none',
            background: '#1976d2', color: '#fff', cursor: 'pointer', fontWeight: 500,
          }}
        >
          + 导入订阅
        </button>
      </div>

      {msg && (
        <div style={{ padding: '8px 16px', borderRadius: 8, background: '#e3f2fd', marginBottom: 16, fontSize: 14 }}>
          {msg}
          <button onClick={() => setMsg('')} style={{ float: 'right', border: 'none', background: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* 导入表单 */}
      {showAdd && (
        <div style={{ padding: 20, border: '1px solid #e0e0e0', borderRadius: 12, marginBottom: 20, background: '#fafafa' }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <input
              placeholder="订阅名称"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14 }}
            />
            <input
              placeholder="订阅链接 URL"
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              style={{ flex: 3, padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={handlePreview} disabled={loading || !newUrl}
              style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>
              预览
            </button>
            <button onClick={handleAdd} disabled={loading || !newUrl || !newName}
              style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#1976d2', color: '#fff', cursor: 'pointer' }}>
              导入
            </button>
          </div>
          {preview && (
            <div style={{ marginTop: 12, padding: 12, background: '#fff', borderRadius: 8, border: '1px solid #e0e0e0' }}>
              <div style={{ fontSize: 14, color: '#666' }}>
                检测到 <b>{preview.proxyCount}</b> 个代理节点, <b>{preview.groupCount}</b> 个代理组
              </div>
              {preview.proxies?.slice(0, 10).map((p: any, i: number) => (
                <span key={i} style={{ display: 'inline-block', margin: '4px 4px 0 0', padding: '2px 8px', background: '#e3f2fd', borderRadius: 4, fontSize: 12 }}>
                  {p.name} ({p.type})
                </span>
              ))}
              {preview.proxyCount > 10 && <span style={{ fontSize: 12, color: '#999' }}>...等 {preview.proxyCount} 个</span>}
            </div>
          )}
        </div>
      )}

      {/* 订阅列表 */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, color: '#666', marginBottom: 12 }}>已导入订阅 ({subscriptions.length})</h3>
        {subscriptions.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#999', border: '1px dashed #ddd', borderRadius: 12 }}>
            暂无订阅，点击上方"导入订阅"添加
          </div>
        ) : (
          subscriptions.map((sub) => (
            <div key={sub.id} style={{
              padding: '12px 16px', border: '1px solid #e0e0e0', borderRadius: 10,
              marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontWeight: 500 }}>{sub.name}</div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                  {sub.proxyCount} 节点 | {sub.status === 'active' ? '✅ 正常' : sub.status === 'error' ? '❌ 错误' : '⏳ 等待'}
                  {sub.lastUpdate && ` | 更新于 ${new Date(sub.lastUpdate).toLocaleString()}`}
                </div>
                {sub.lastError && <div style={{ fontSize: 12, color: '#f44336', marginTop: 2 }}>{sub.lastError}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleUpdate(sub.id)}
                  style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: 12 }}>
                  更新
                </button>
                <button onClick={() => handleDelete(sub.id)}
                  style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #f44336', color: '#f44336', background: '#fff', cursor: 'pointer', fontSize: 12 }}>
                  删除
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 代理组 (运行时) */}
      <h3 style={{ fontSize: 16, color: '#666', marginBottom: 12 }}>代理组 (运行时切换)</h3>
      {groups.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#999', border: '1px dashed #ddd', borderRadius: 12 }}>
          Clash 未运行或无代理组
        </div>
      ) : (
        groups.map(([name, group]: [string, any]) => (
          <ProxyGroupCard
            key={name}
            name={name}
            type={group.type}
            now={group.now}
            all={group.all || []}
            onSelect={(proxy) => handleSelectProxy(name, proxy)}
          />
        ))
      )}
    </div>
  );
};

export default ProfilesPage;
