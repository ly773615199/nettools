import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Container, Chip, LinearProgress, IconButton, Tooltip, Skeleton
} from '@mui/material';
import {
  Folder, NetworkCheck, Settings, Memory, Dns, Speed, Refresh,
  Download, Upload, CheckCircle, Error as ErrorIcon, Shield
} from '@mui/icons-material';
import { apiClient } from '../core/api/apiClient';
import { t } from '../core/i18n/i18n';

// 后端 /health 返回的数据结构
interface HealthData {
  status: string;
  uptime: number;
  version: string;
  system: {
    platform: string;
    arch: string;
    nodeVersion: string;
    hostname: string;
    cpuCount: number;
    totalMemory: number;
    freeMemory: number;
    loadAvg: number[];
  };
  process: {
    pid: number;
    memory: { rss: number; heapUsed: number; heapTotal: number };
  };
  services: {
    clash: { running: boolean; hasBinary: boolean };
    websocket: { connections: number };
  };
}

// 网络流量数据
interface TrafficData {
  interfaces: Array<{
    name: string;
    rx_bytes: number;
    tx_bytes: number;
    rx_packets: number;
    tx_packets: number;
  }>;
}

// 格式化字节数
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + units[i];
}

// 格式化运行时间
function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// 状态卡片组件
interface StatusCardProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  color?: string;
}

const StatusCard: React.FC<StatusCardProps> = ({ title, icon, children, color = '#1976d2' }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Box sx={{ color, mr: 1.5, display: 'flex' }}>{icon}</Box>
        <Typography variant="subtitle1" fontWeight={600}>{title}</Typography>
      </Box>
      {children}
    </CardContent>
  </Card>
);

// 指标行
const MetricRow: React.FC<{ label: string; value: string | number; sub?: string }> = ({ label, value, sub }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
    <Typography variant="body2" color="text.secondary">{label}</Typography>
    <Box sx={{ textAlign: 'right' }}>
      <Typography variant="body2" fontWeight={500}>{value}</Typography>
      {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
    </Box>
  </Box>
);

const HomePage: React.FC = () => {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [traffic, setTraffic] = useState<TrafficData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchData = async () => {
    try {
      const [healthRes, trafficRes] = await Promise.all([
        apiClient.get<HealthData>('/health'),
        apiClient.get<TrafficData>('/network/traffic'),
      ]);
      if (healthRes.data) setHealth(healthRes.data);
      if (trafficRes.data) setTraffic(trafficRes.data as any);
      setLastUpdate(new Date());
    } catch (e) {
      console.error('Dashboard fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // 10秒刷新
    return () => clearInterval(interval);
  }, []);

  const memUsed = health ? health.system.totalMemory - health.system.freeMemory : 0;
  const memPercent = health ? Math.round((memUsed / health.system.totalMemory) * 100) : 0;
  const heapPercent = health ? Math.round((health.process.memory.heapUsed / health.process.memory.heapTotal) * 100) : 0;

  // 汇总流量
  const totalRx = traffic?.interfaces?.reduce((s, i) => s + i.rx_bytes, 0) || 0;
  const totalTx = traffic?.interfaces?.reduce((s, i) => s + i.tx_bytes, 0) || 0;

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Skeleton variant="text" width={300} height={40} />
        <Box sx={{ display: 'flex', gap: 3, mt: 3, flexWrap: 'wrap' }}>
          {[1, 2, 3, 4].map(i => (
            <Box key={i} sx={{ flex: '1 1 250px', minWidth: 250 }}>
              <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
            </Box>
          ))}
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      {/* Header */}
      <Box sx={{ mt: 4, mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" fontWeight={700}>
            {t('home.welcome')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('home.description')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {lastUpdate.toLocaleTimeString()}
          </Typography>
          <Tooltip title="刷新">
            <IconButton size="small" onClick={fetchData}><Refresh fontSize="small" /></IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Status Cards Row */}
      <Box sx={{ display: 'flex', gap: 3, mb: 3, flexWrap: 'wrap' }}>
        {/* 系统状态 */}
        <Box sx={{ flex: '1 1 250px', minWidth: 250 }}>
          <StatusCard title="系统" icon={<Memory />} color="#1976d2">
            {health && (
              <>
                <MetricRow label="平台" value={`${health.system.platform} ${health.system.arch}`} />
                <MetricRow label="Node" value={health.system.nodeVersion} />
                <MetricRow label="运行时间" value={formatUptime(health.uptime)} />
                <MetricRow label="CPU" value={`${health.system.cpuCount} 核`} sub={`负载 ${health.system.loadAvg[0].toFixed(2)}`} />
                <Box sx={{ mt: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">内存</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatBytes(memUsed)} / {formatBytes(health.system.totalMemory)} ({memPercent}%)
                    </Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={memPercent} sx={{ height: 6, borderRadius: 3 }} />
                </Box>
              </>
            )}
          </StatusCard>
        </Box>

        {/* 进程状态 */}
        <Box sx={{ flex: '1 1 250px', minWidth: 250 }}>
          <StatusCard title="进程" icon={<Dns />} color="#2e7d32">
            {health && (
              <>
                <MetricRow label="PID" value={health.process.pid} />
                <MetricRow label="RSS" value={formatBytes(health.process.memory.rss)} />
                <Box sx={{ mt: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">Heap</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatBytes(health.process.memory.heapUsed)} / {formatBytes(health.process.memory.heapTotal)} ({heapPercent}%)
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={heapPercent}
                    color="success"
                    sx={{ height: 6, borderRadius: 3 }}
                  />
                </Box>
                <Box sx={{ mt: 1.5 }}>
                  <MetricRow label="WebSocket" value={`${health.services.websocket.connections} 连接`} />
                </Box>
              </>
            )}
          </StatusCard>
        </Box>

        {/* 服务状态 */}
        <Box sx={{ flex: '1 1 250px', minWidth: 250 }}>
          <StatusCard title="服务" icon={<Shield />} color="#ed6c02">
            {health && (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">Clash 代理</Typography>
                  <Chip
                    size="small"
                    icon={health.services.clash.running ? <CheckCircle /> : <ErrorIcon />}
                    label={health.services.clash.running ? '运行中' : health.services.clash.hasBinary ? '已停止' : '未安装'}
                    color={health.services.clash.running ? 'success' : 'default'}
                    variant="outlined"
                  />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">WebSocket</Typography>
                  <Chip
                    size="small"
                    icon={<CheckCircle />}
                    label="在线"
                    color="success"
                    variant="outlined"
                  />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">版本</Typography>
                  <Typography variant="body2" fontWeight={500}>{health.version}</Typography>
                </Box>
              </>
            )}
          </StatusCard>
        </Box>

        {/* 网络流量 */}
        <Box sx={{ flex: '1 1 250px', minWidth: 250 }}>
          <StatusCard title="网络流量" icon={<Speed />} color="#9c27b0">
            <Box sx={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
              <Box>
                <Download sx={{ fontSize: 28, color: '#1976d2', mb: 0.5 }} />
                <Typography variant="h6" fontWeight={600}>{formatBytes(totalRx)}</Typography>
                <Typography variant="caption" color="text.secondary">接收</Typography>
              </Box>
              <Box>
                <Upload sx={{ fontSize: 28, color: '#2e7d32', mb: 0.5 }} />
                <Typography variant="h6" fontWeight={600}>{formatBytes(totalTx)}</Typography>
                <Typography variant="caption" color="text.secondary">发送</Typography>
              </Box>
            </Box>
            {traffic?.interfaces && traffic.interfaces.length > 0 && (
              <Box sx={{ mt: 1.5 }}>
                {traffic.interfaces.slice(0, 3).map((iface, i) => (
                  <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.3 }}>
                    <Typography variant="caption" color="text.secondary">{iface.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      ↓{formatBytes(iface.rx_bytes)} ↑{formatBytes(iface.tx_bytes)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </StatusCard>
        </Box>
      </Box>

      {/* Quick Navigation */}
      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        <Box sx={{ flex: '1 1 300px' }}>
          <Card sx={{ cursor: 'pointer', '&:hover': { boxShadow: 4 }, textDecoration: 'none' }} component="a" href="/files">
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Folder sx={{ fontSize: 40, color: '#1976d2' }} />
              <Box>
                <Typography variant="h6">{t('home.fileManagement')}</Typography>
                <Typography variant="body2" color="text.secondary">{t('home.fileManagementDescription')}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ flex: '1 1 300px' }}>
          <Card sx={{ cursor: 'pointer', '&:hover': { boxShadow: 4 }, textDecoration: 'none' }} component="a" href="/network">
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <NetworkCheck sx={{ fontSize: 40, color: '#2e7d32' }} />
              <Box>
                <Typography variant="h6">{t('home.networkTools')}</Typography>
                <Typography variant="body2" color="text.secondary">{t('home.networkToolsDescription')}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ flex: '1 1 300px' }}>
          <Card sx={{ cursor: 'pointer', '&:hover': { boxShadow: 4 }, textDecoration: 'none' }} component="a" href="/settings">
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Settings sx={{ fontSize: 40, color: '#ed6c02' }} />
              <Box>
                <Typography variant="h6">{t('home.settings')}</Typography>
                <Typography variant="body2" color="text.secondary">{t('home.settingsDescription')}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Container>
  );
};

export default HomePage;
