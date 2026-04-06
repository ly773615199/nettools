// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Container, Chip, IconButton, Tooltip, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Select, MenuItem,
  FormControl, InputLabel, Grid, LinearProgress, Alert, Tabs, Tab, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Switch, FormControlLabel,
  Stepper, Step, StepLabel, StepContent, Divider, List, ListItem, ListItemText,
  ListItemIcon, Accordion, AccordionSummary, AccordionDetails, Snackbar
} from '@mui/material';
import {
  Router as RouterIcon, Cloud, Computer, Storage as NasIcon, Add, Delete, Edit,
  PlayArrow, Stop, Refresh, Download, ContentCopy, ExpandMore, CheckCircle,
  Error as ErrorIcon, Warning, Info, Speed, VpnKey, Settings, Visibility,
  VisibilityOff, Terminal, Link, LinkOff, Shield, Public, Dns
} from '@mui/icons-material';
import { apiClient } from '../core/api/apiClient';
import { t } from '../core/i18n/i18n';

// ==================== 类型定义 ====================

interface PenetrationNode {
  id: number;
  name: string;
  nodeType: 'vps' | 'nas' | 'local' | 'cloud';
  host: string;
  sshPort: number;
  sshUser: string;
  sshAuth: 'key' | 'password' | 'none';
  sshKeyPath?: string;
  osType?: string;
  arch?: string;
  hasRoot: boolean;
  hasDocker: boolean;
  publicIp?: string;
  pkgManager?: string;
  installed: Record<string, boolean>;
  status: 'unknown' | 'reachable' | 'unreachable';
  lastSeenAt?: string;
  userId: number;
  createdAt: string;
  updatedAt: string;
}

interface PenetrationInstance {
  id: number;
  name: string;
  type: 'wireguard' | 'bore' | 'frp' | 'ssh' | 'cloudflare';
  serverNodeId?: number;
  clientNodeId?: number;
  role: 'server' | 'client' | 'both';
  mappings: Array<{ localPort: number; remotePort: number; protocol: string; domain?: string; name?: string; frpType?: string }>;
  config: Record<string, any>;
  status: 'created' | 'running' | 'stopped' | 'error';
  pid?: number;
  lastError?: string;
  bytesUp: number;
  bytesDown: number;
  lastActiveAt?: string;
  running?: boolean;
  uptime?: number;
  userId: number;
  createdAt: string;
  updatedAt: string;
}

interface PenetrationType {
  type: string;
  name: string;
  description: string;
  needsPublicServer: boolean;
  needsRoot: boolean;
  protocols: string[];
}

interface NodeInfo {
  osType: string;
  arch: string;
  hasRoot: boolean;
  hasDocker: boolean;
  installed: Record<string, boolean>;
  publicIp?: string;
  pkgManager: string;
  isNAS: boolean;
}

// ==================== 辅助函数 ====================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + units[i];
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function getNodeIcon(nodeType: string) {
  switch (nodeType) {
    case 'vps': return <Cloud />;
    case 'nas': return <NasIcon />;
    case 'local': return <Computer />;
    case 'cloud': return <Public />;
    default: return <RouterIcon />;
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'wireguard': return <Shield />;
    case 'bore': return <Link />;
    case 'frp': return <Dns />;
    case 'ssh': return <Terminal />;
    case 'cloudflare': return <Public />;
    default: return <RouterIcon />;
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'running': case 'reachable': return 'success';
    case 'stopped': case 'created': return 'default';
    case 'error': case 'unreachable': return 'error';
    case 'unknown': return 'warning';
    default: return 'default';
  }
}

// ==================== 节点卡片组件 ====================

interface NodeCardProps {
  node: PenetrationNode;
  instances: PenetrationInstance[];
  onDetect: (node: PenetrationNode) => void;
  onTest: (node: PenetrationNode) => void;
  onDeploy: (node: PenetrationNode) => void;
  onEdit: (node: PenetrationNode) => void;
  onDelete: (node: PenetrationNode) => void;
}

const NodeCard: React.FC<NodeCardProps> = ({ node, instances, onDetect, onTest, onDeploy, onEdit, onDelete }) => {
  const runningCount = instances.filter(i =>
    (i.serverNodeId === node.id || i.clientNodeId === node.id) && i.status === 'running'
  ).length;

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ color: node.status === 'reachable' ? 'success.main' : 'text.secondary' }}>
              {getNodeIcon(node.nodeType)}
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>{node.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {node.host} {node.osType && `• ${node.osType}`} {node.arch && `• ${node.arch}`}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              size="small"
              label={node.status}
              color={getStatusColor(node.status) as any}
            />
            {runningCount > 0 && (
              <Chip size="small" label={`${runningCount} running`} color="primary" variant="outlined" />
            )}
          </Box>
        </Box>

        {/* 已安装组件 */}
        <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {Object.entries(node.installed || {}).map(([key, value]) => (
            <Chip
              key={key}
              size="small"
              label={key}
              color={value ? 'success' : 'default'}
              variant={value ? 'filled' : 'outlined'}
              icon={value ? <CheckCircle sx={{ fontSize: 16 }} /> : undefined}
            />
          ))}
        </Box>

        {/* 操作按钮 */}
        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
          <Button size="small" startIcon={<Refresh />} onClick={() => onDetect(node)}>检测</Button>
          <Button size="small" startIcon={<Speed />} onClick={() => onTest(node)}>测试</Button>
          <Button size="small" startIcon={<Settings />} onClick={() => onDeploy(node)}>部署</Button>
          <Button size="small" startIcon={<Edit />} onClick={() => onEdit(node)}>编辑</Button>
          <Button size="small" startIcon={<Delete />} color="error" onClick={() => onDelete(node)}>删除</Button>
        </Box>
      </CardContent>
    </Card>
  );
};

// ==================== 实例卡片组件 ====================

interface InstanceCardProps {
  instance: PenetrationInstance;
  nodes: PenetrationNode[];
  onStart: (instance: PenetrationInstance) => void;
  onStop: (instance: PenetrationInstance) => void;
  onRestart: (instance: PenetrationInstance) => void;
  onDelete: (instance: PenetrationInstance) => void;
  onExport: (instance: PenetrationInstance) => void;
  onEdit: (instance: PenetrationInstance) => void;
}

const InstanceCard: React.FC<InstanceCardProps> = ({
  instance, nodes, onStart, onStop, onRestart, onDelete, onExport, onEdit
}) => {
  const serverNode = nodes.find(n => n.id === instance.serverNodeId);
  const clientNode = nodes.find(n => n.id === instance.clientNodeId);

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ color: instance.status === 'running' ? 'success.main' : 'text.secondary' }}>
              {getTypeIcon(instance.type)}
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>{instance.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {instance.type.toUpperCase()} • {instance.role}
              </Typography>
            </Box>
          </Box>
          <Chip
            size="small"
            label={instance.status}
            color={getStatusColor(instance.status) as any}
          />
        </Box>

        {/* 节点信息 */}
        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            size="small"
            icon={<Computer />}
            label={clientNode?.name || '本机'}
            variant="outlined"
          />
          <Typography variant="body2" color="text.secondary">→</Typography>
          <Chip
            size="small"
            icon={<Cloud />}
            label={serverNode?.name || '服务器'}
            variant="outlined"
          />
        </Box>

        {/* 端口映射 */}
        {instance.mappings.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Typography variant="caption" color="text.secondary">端口映射:</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
              {instance.mappings.map((m, i) => (
                <Chip
                  key={i}
                  size="small"
                  label={`${m.localPort}→${m.remotePort}`}
                  variant="outlined"
                />
              ))}
            </Box>
          </Box>
        )}

        {/* 流量统计 */}
        {instance.status === 'running' && (
          <Box sx={{ mt: 1.5, display: 'flex', gap: 2 }}>
            <Typography variant="caption" color="text.secondary">
              ↑ {formatBytes(instance.bytesUp || 0)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              ↓ {formatBytes(instance.bytesDown || 0)}
            </Typography>
            {instance.uptime && (
              <Typography variant="caption" color="text.secondary">
                运行 {formatUptime(Math.floor(instance.uptime / 1000))}
              </Typography>
            )}
          </Box>
        )}

        {/* 错误信息 */}
        {instance.lastError && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {instance.lastError}
          </Alert>
        )}

        {/* 操作按钮 */}
        <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {instance.status !== 'running' ? (
            <Button size="small" variant="contained" startIcon={<PlayArrow />} onClick={() => onStart(instance)}>
              启动
            </Button>
          ) : (
            <Button size="small" variant="outlined" startIcon={<Stop />} onClick={() => onStop(instance)}>
              停止
            </Button>
          )}
          <Button size="small" startIcon={<Refresh />} onClick={() => onRestart(instance)}>重启</Button>
          <Button size="small" startIcon={<Download />} onClick={() => onExport(instance)}>导出配置</Button>
          <Button size="small" startIcon={<Edit />} onClick={() => onEdit(instance)}>编辑</Button>
          <Button size="small" startIcon={<Delete />} color="error" onClick={() => onDelete(instance)}>删除</Button>
        </Box>
      </CardContent>
    </Card>
  );
};

// ==================== 主页面组件 ====================

const PenetrationPage: React.FC = () => {
  // 状态
  const [tab, setTab] = useState(0);
  const [nodes, setNodes] = useState<PenetrationNode[]>([]);
  const [instances, setInstances] = useState<PenetrationInstance[]>([]);
  const [types, setTypes] = useState<PenetrationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false, message: '', severity: 'info'
  });

  // 对话框状态
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false);
  const [instanceDialogOpen, setInstanceDialogOpen] = useState(false);
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<PenetrationNode | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<PenetrationInstance | null>(null);

  // 表单状态
  const [nodeForm, setNodeForm] = useState({
    name: '', nodeType: 'vps' as const, host: '', sshPort: 22, sshUser: 'root',
    sshAuth: 'key' as const, sshKeyPath: '', sshPassword: ''
  });

  const [instanceForm, setInstanceForm] = useState({
    name: '', type: 'bore' as const, serverNodeId: '' as number | '', clientNodeId: '' as number | '',
    role: 'client' as const, mappings: [{ localPort: 3000, remotePort: 80, protocol: 'tcp' }],
    config: {} as Record<string, any>
  });

  const [deployForm, setDeployForm] = useState({
    components: [] as string[], role: 'server' as const
  });

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nodesRes, instancesRes, typesRes] = await Promise.all([
        apiClient.get<{ data: PenetrationNode[] }>('/penetration/nodes'),
        apiClient.get<{ data: PenetrationInstance[] }>('/penetration/instances'),
        apiClient.get<{ data: PenetrationType[] }>('/penetration/types')
      ]);

      if (nodesRes.data?.data) setNodes(nodesRes.data.data);
      if (instancesRes.data?.data) setInstances(instancesRes.data.data);
      if (typesRes.data?.data) setTypes(typesRes.data.data);

      if (nodesRes.error) setError(nodesRes.error);
    } catch (err: any) {
      setError(err.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // 显示提示
  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  // ==================== 节点操作 ====================

  const handleCreateNode = async () => {
    try {
      const res = await apiClient.post('/penetration/nodes', nodeForm);
      if (res.error) throw new Error(res.error);
      showSnackbar('节点创建成功', 'success');
      setNodeDialogOpen(false);
      setNodeForm({ name: '', nodeType: 'vps', host: '', sshPort: 22, sshUser: 'root', sshAuth: 'key', sshKeyPath: '', sshPassword: '' });
      loadData();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const handleUpdateNode = async () => {
    if (!selectedNode) return;
    try {
      const res = await apiClient.put(`/penetration/nodes/${selectedNode.id}`, nodeForm);
      if (res.error) throw new Error(res.error);
      showSnackbar('节点更新成功', 'success');
      setNodeDialogOpen(false);
      setSelectedNode(null);
      loadData();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const handleDeleteNode = async (node: PenetrationNode) => {
    if (!confirm(`确定删除节点 "${node.name}"？`)) return;
    try {
      const res = await apiClient.delete(`/penetration/nodes/${node.id}`);
      if (res.error) throw new Error(res.error);
      showSnackbar('节点删除成功', 'success');
      loadData();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const handleDetectNode = async (node: PenetrationNode) => {
    showSnackbar(`正在检测节点 "${node.name}"...`, 'info');
    try {
      const res = await apiClient.post(`/penetration/nodes/${node.id}/detect`, {});
      if (res.error) throw new Error(res.error);
      showSnackbar('节点检测完成', 'success');
      loadData();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const handleTestNode = async (node: PenetrationNode) => {
    try {
      const res = await apiClient.post<{ data: { reachable: boolean; latency?: number; error?: string } }>(`/penetration/nodes/${node.id}/test`, {});
      if (res.error) throw new Error(res.error);
      const result = res.data?.data;
      if (result?.reachable) {
        showSnackbar(`节点可达，延迟 ${result.latency}ms`, 'success');
      } else {
        showSnackbar(`节点不可达: ${result?.error}`, 'error');
      }
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const handleDeployNode = async () => {
    if (!selectedNode) return;
    try {
      const res = await apiClient.post(`/penetration/nodes/${selectedNode.id}/deploy`, deployForm);
      if (res.error) throw new Error(res.error);
      showSnackbar('部署完成', 'success');
      setDeployDialogOpen(false);
      setSelectedNode(null);
      loadData();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const openEditNodeDialog = (node: PenetrationNode) => {
    setSelectedNode(node);
    setNodeForm({
      name: node.name,
      nodeType: node.nodeType,
      host: node.host,
      sshPort: node.sshPort,
      sshUser: node.sshUser,
      sshAuth: node.sshAuth,
      sshKeyPath: node.sshKeyPath || '',
      sshPassword: ''
    });
    setNodeDialogOpen(true);
  };

  const openDeployDialog = (node: PenetrationNode) => {
    setSelectedNode(node);
    setDeployForm({ components: [], role: 'server' });
    setDeployDialogOpen(true);
  };

  // ==================== 实例操作 ====================

  const handleCreateInstance = async () => {
    try {
      const payload = {
        ...instanceForm,
        serverNodeId: instanceForm.serverNodeId || null,
        clientNodeId: instanceForm.clientNodeId || null,
      };
      const res = await apiClient.post('/penetration/instances', payload);
      if (res.error) throw new Error(res.error);
      showSnackbar('实例创建成功', 'success');
      setInstanceDialogOpen(false);
      setInstanceForm({
        name: '', type: 'bore', serverNodeId: '', clientNodeId: '', role: 'client',
        mappings: [{ localPort: 3000, remotePort: 80, protocol: 'tcp' }],
        config: {}
      });
      loadData();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const handleUpdateInstance = async () => {
    if (!selectedInstance) return;
    try {
      const payload = {
        ...instanceForm,
        serverNodeId: instanceForm.serverNodeId || null,
        clientNodeId: instanceForm.clientNodeId || null,
      };
      const res = await apiClient.put(`/penetration/instances/${selectedInstance.id}`, payload);
      if (res.error) throw new Error(res.error);
      showSnackbar('实例更新成功', 'success');
      setInstanceDialogOpen(false);
      setSelectedInstance(null);
      loadData();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const handleStartInstance = async (instance: PenetrationInstance) => {
    try {
      const res = await apiClient.post(`/penetration/instances/${instance.id}/start`, {});
      if (res.error) throw new Error(res.error);
      showSnackbar('实例启动成功', 'success');
      loadData();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const handleStopInstance = async (instance: PenetrationInstance) => {
    try {
      const res = await apiClient.post(`/penetration/instances/${instance.id}/stop`, {});
      if (res.error) throw new Error(res.error);
      showSnackbar('实例已停止', 'success');
      loadData();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const handleRestartInstance = async (instance: PenetrationInstance) => {
    try {
      const res = await apiClient.post(`/penetration/instances/${instance.id}/restart`, {});
      if (res.error) throw new Error(res.error);
      showSnackbar('实例重启成功', 'success');
      loadData();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const handleDeleteInstance = async (instance: PenetrationInstance) => {
    if (!confirm(`确定删除实例 "${instance.name}"？`)) return;
    try {
      const res = await apiClient.delete(`/penetration/instances/${instance.id}`);
      if (res.error) throw new Error(res.error);
      showSnackbar('实例删除成功', 'success');
      loadData();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const handleExportConfig = async (instance: PenetrationInstance) => {
    try {
      const res = await apiClient.get<{ data: { content: string; filename: string } }>(`/penetration/instances/${instance.id}/export`);
      if (res.error) throw new Error(res.error);
      const config = res.data?.data;
      if (config) {
        // 下载配置文件
        const blob = new Blob([config.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = config.filename;
        a.click();
        URL.revokeObjectURL(url);
        showSnackbar('配置已导出', 'success');
      }
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const openEditInstanceDialog = (instance: PenetrationInstance) => {
    setSelectedInstance(instance);
    setInstanceForm({
      name: instance.name,
      type: instance.type,
      serverNodeId: instance.serverNodeId || '',
      clientNodeId: instance.clientNodeId || '',
      role: instance.role,
      mappings: instance.mappings.length > 0 ? instance.mappings : [{ localPort: 3000, remotePort: 80, protocol: 'tcp' }],
      config: instance.config
    });
    setInstanceDialogOpen(true);
  };

  // ==================== 渲染 ====================

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          <Typography variant="h5" gutterBottom>穿透管理</Typography>
          <LinearProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        {/* 标题栏 */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <RouterIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Typography variant="h5" fontWeight={600}>穿透管理</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" startIcon={<Refresh />} onClick={loadData}>刷新</Button>
          </Box>
        </Box>

        {/* 错误提示 */}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* 标签页 */}
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
          <Tab label={`📡 节点 (${nodes.length})`} />
          <Tab label={`🔌 穿透实例 (${instances.length})`} />
        </Tabs>

        {/* 节点列表 */}
        {tab === 0 && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => {
                  setSelectedNode(null);
                  setNodeForm({ name: '', nodeType: 'vps', host: '', sshPort: 22, sshUser: 'root', sshAuth: 'key', sshKeyPath: '', sshPassword: '' });
                  setNodeDialogOpen(true);
                }}
              >
                添加节点
              </Button>
            </Box>

            {nodes.length === 0 ? (
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 6 }}>
                  <RouterIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    还没有穿透节点
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    添加 VPS、NAS 或本地电脑作为穿透节点
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => setNodeDialogOpen(true)}
                  >
                    添加第一个节点
                  </Button>
                </CardContent>
              </Card>
            ) : (
              nodes.map(node => (
                <NodeCard
                  key={node.id}
                  node={node}
                  instances={instances}
                  onDetect={handleDetectNode}
                  onTest={handleTestNode}
                  onDeploy={openDeployDialog}
                  onEdit={openEditNodeDialog}
                  onDelete={handleDeleteNode}
                />
              ))
            )}
          </Box>
        )}

        {/* 实例列表 */}
        {tab === 1 && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => {
                  setSelectedInstance(null);
                  setInstanceForm({
                    name: '', type: 'bore', serverNodeId: '', clientNodeId: '', role: 'client',
                    mappings: [{ localPort: 3000, remotePort: 80, protocol: 'tcp' }],
                    config: {}
                  });
                  setInstanceDialogOpen(true);
                }}
              >
                创建穿透实例
              </Button>
            </Box>

            {instances.length === 0 ? (
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 6 }}>
                  <Link sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    还没有穿透实例
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    创建穿透实例将本地服务暴露到公网
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => setInstanceDialogOpen(true)}
                  >
                    创建第一个实例
                  </Button>
                </CardContent>
              </Card>
            ) : (
              instances.map(instance => (
                <InstanceCard
                  key={instance.id}
                  instance={instance}
                  nodes={nodes}
                  onStart={handleStartInstance}
                  onStop={handleStopInstance}
                  onRestart={handleRestartInstance}
                  onDelete={handleDeleteInstance}
                  onExport={handleExportConfig}
                  onEdit={openEditInstanceDialog}
                />
              ))
            )}
          </Box>
        )}

        {/* ==================== 节点对话框 ==================== */}
        <Dialog open={nodeDialogOpen} onClose={() => setNodeDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{selectedNode ? '编辑节点' : '添加穿透节点'}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                label="节点名称"
                value={nodeForm.name}
                onChange={e => setNodeForm({ ...nodeForm, name: e.target.value })}
                placeholder="阿里云VPS、家里NAS..."
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel>节点类型</InputLabel>
                <Select
                  value={nodeForm.nodeType}
                  label="节点类型"
                  onChange={e => setNodeForm({ ...nodeForm, nodeType: e.target.value as any })}
                >
                  <MenuItem value="vps">☁️ 云服务器/VPS</MenuItem>
                  <MenuItem value="nas">📦 NAS (群晖/QNAP)</MenuItem>
                  <MenuItem value="local">💻 本地电脑</MenuItem>
                  <MenuItem value="cloud">🌐 云主机</MenuItem>
                </Select>
              </FormControl>

              {nodeForm.nodeType !== 'local' && (
                <>
                  <TextField
                    label="主机地址"
                    value={nodeForm.host}
                    onChange={e => setNodeForm({ ...nodeForm, host: e.target.value })}
                    placeholder="IP 或域名"
                    fullWidth
                  />
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      label="SSH 端口"
                      type="number"
                      value={nodeForm.sshPort}
                      onChange={e => setNodeForm({ ...nodeForm, sshPort: parseInt(e.target.value) || 22 })}
                      sx={{ width: 120 }}
                    />
                    <TextField
                      label="SSH 用户"
                      value={nodeForm.sshUser}
                      onChange={e => setNodeForm({ ...nodeForm, sshUser: e.target.value })}
                      sx={{ flex: 1 }}
                    />
                  </Box>
                  <FormControl fullWidth>
                    <InputLabel>认证方式</InputLabel>
                    <Select
                      value={nodeForm.sshAuth}
                      label="认证方式"
                      onChange={e => setNodeForm({ ...nodeForm, sshAuth: e.target.value as any })}
                    >
                      <MenuItem value="key">密钥认证</MenuItem>
                      <MenuItem value="password">密码认证</MenuItem>
                    </Select>
                  </FormControl>
                  {nodeForm.sshAuth === 'key' ? (
                    <TextField
                      label="SSH 私钥路径"
                      value={nodeForm.sshKeyPath}
                      onChange={e => setNodeForm({ ...nodeForm, sshKeyPath: e.target.value })}
                      placeholder="/root/.ssh/id_rsa"
                      fullWidth
                    />
                  ) : (
                    <TextField
                      label="SSH 密码"
                      type="password"
                      value={nodeForm.sshPassword}
                      onChange={e => setNodeForm({ ...nodeForm, sshPassword: e.target.value })}
                      fullWidth
                    />
                  )}
                </>
              )}

              {nodeForm.nodeType === 'local' && (
                <Alert severity="info">
                  本地节点会自动检测系统信息，无需填写连接信息
                </Alert>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setNodeDialogOpen(false)}>取消</Button>
            <Button
              variant="contained"
              onClick={selectedNode ? handleUpdateNode : handleCreateNode}
              disabled={!nodeForm.name}
            >
              {selectedNode ? '更新' : '创建'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ==================== 实例对话框 ==================== */}
        <Dialog open={instanceDialogOpen} onClose={() => setInstanceDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>{selectedInstance ? '编辑穿透实例' : '创建穿透实例'}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                label="实例名称"
                value={instanceForm.name}
                onChange={e => setInstanceForm({ ...instanceForm, name: e.target.value })}
                placeholder="家里Web暴露到VPS"
                fullWidth
              />

              <FormControl fullWidth>
                <InputLabel>穿透方法</InputLabel>
                <Select
                  value={instanceForm.type}
                  label="穿透方法"
                  onChange={e => setInstanceForm({ ...instanceForm, type: e.target.value as any })}
                >
                  {types.map(t => (
                    <MenuItem key={t.type} value={t.type}>
                      {t.name} — {t.description}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>客户端节点</InputLabel>
                  <Select
                    value={instanceForm.clientNodeId}
                    label="客户端节点"
                    onChange={e => setInstanceForm({ ...instanceForm, clientNodeId: e.target.value as number | '' })}
                  >
                    <MenuItem value="">本机</MenuItem>
                    {nodes.map(n => (
                      <MenuItem key={n.id} value={n.id}>{n.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {instanceForm.type !== 'cloudflare' && (
                  <FormControl fullWidth>
                    <InputLabel>服务端节点</InputLabel>
                    <Select
                      value={instanceForm.serverNodeId}
                      label="服务端节点"
                      onChange={e => setInstanceForm({ ...instanceForm, serverNodeId: e.target.value as number | '' })}
                    >
                      <MenuItem value="">无</MenuItem>
                      {nodes.map(n => (
                        <MenuItem key={n.id} value={n.id}>{n.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Box>

              <Divider />

              {/* 端口映射 */}
              <Typography variant="subtitle2">端口映射</Typography>
              {instanceForm.mappings.map((m, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <TextField
                    label="本地端口"
                    type="number"
                    value={m.localPort}
                    onChange={e => {
                      const newMappings = [...instanceForm.mappings];
                      newMappings[i] = { ...m, localPort: parseInt(e.target.value) || 0 };
                      setInstanceForm({ ...instanceForm, mappings: newMappings });
                    }}
                    sx={{ width: 120 }}
                  />
                  <TextField
                    label="远程端口"
                    type="number"
                    value={m.remotePort}
                    onChange={e => {
                      const newMappings = [...instanceForm.mappings];
                      newMappings[i] = { ...m, remotePort: parseInt(e.target.value) || 0 };
                      setInstanceForm({ ...instanceForm, mappings: newMappings });
                    }}
                    sx={{ width: 120 }}
                  />
                  <FormControl sx={{ width: 100 }}>
                    <InputLabel>协议</InputLabel>
                    <Select
                      value={m.protocol}
                      label="协议"
                      onChange={e => {
                        const newMappings = [...instanceForm.mappings];
                        newMappings[i] = { ...m, protocol: e.target.value };
                        setInstanceForm({ ...instanceForm, mappings: newMappings });
                      }}
                    >
                      <MenuItem value="tcp">TCP</MenuItem>
                      <MenuItem value="udp">UDP</MenuItem>
                    </Select>
                  </FormControl>
                  {(instanceForm.type === 'frp' || instanceForm.type === 'cloudflare') && (
                    <TextField
                      label="域名(可选)"
                      value={m.domain || ''}
                      onChange={e => {
                        const newMappings = [...instanceForm.mappings];
                        newMappings[i] = { ...m, domain: e.target.value };
                        setInstanceForm({ ...instanceForm, mappings: newMappings });
                      }}
                      sx={{ flex: 1 }}
                    />
                  )}
                  <IconButton
                    color="error"
                    onClick={() => {
                      const newMappings = instanceForm.mappings.filter((_, j) => j !== i);
                      setInstanceForm({ ...instanceForm, mappings: newMappings });
                    }}
                    disabled={instanceForm.mappings.length <= 1}
                  >
                    <Delete />
                  </IconButton>
                </Box>
              ))}
              <Button
                startIcon={<Add />}
                onClick={() => setInstanceForm({
                  ...instanceForm,
                  mappings: [...instanceForm.mappings, { localPort: 3000, remotePort: 80, protocol: 'tcp' }]
                })}
              >
                添加映射
              </Button>

              {/* 协议特定配置 */}
              <Divider />
              <Typography variant="subtitle2">高级配置</Typography>

              {instanceForm.type === 'wireguard' && (
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    label="监听端口"
                    type="number"
                    value={instanceForm.config.listenPort || 51820}
                    onChange={e => setInstanceForm({
                      ...instanceForm,
                      config: { ...instanceForm.config, listenPort: parseInt(e.target.value) || 51820 }
                    })}
                    sx={{ width: 150 }}
                  />
                  <TextField
                    label="子网"
                    value={instanceForm.config.subnet || '10.8.0.0/24'}
                    onChange={e => setInstanceForm({
                      ...instanceForm,
                      config: { ...instanceForm.config, subnet: e.target.value }
                    })}
                    sx={{ flex: 1 }}
                  />
                </Box>
              )}

              {instanceForm.type === 'frp' && (
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    label="绑定端口"
                    type="number"
                    value={instanceForm.config.bindPort || 7000}
                    onChange={e => setInstanceForm({
                      ...instanceForm,
                      config: { ...instanceForm.config, bindPort: parseInt(e.target.value) || 7000 }
                    })}
                    sx={{ width: 150 }}
                  />
                  <TextField
                    label="认证 Token"
                    value={instanceForm.config.token || ''}
                    onChange={e => setInstanceForm({
                      ...instanceForm,
                      config: { ...instanceForm.config, token: e.target.value }
                    })}
                    sx={{ flex: 1 }}
                    placeholder="留空自动生成"
                  />
                </Box>
              )}

              {instanceForm.type === 'bore' && (
                <TextField
                  label="Secret (可选)"
                  value={instanceForm.config.secret || ''}
                  onChange={e => setInstanceForm({
                    ...instanceForm,
                    config: { ...instanceForm.config, secret: e.target.value }
                  })}
                  fullWidth
                  placeholder="留空自动生成"
                />
              )}

              {instanceForm.type === 'ssh' && (
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    label="服务器地址"
                    value={instanceForm.config.serverHost || ''}
                    onChange={e => setInstanceForm({
                      ...instanceForm,
                      config: { ...instanceForm.config, serverHost: e.target.value }
                    })}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    label="SSH 用户"
                    value={instanceForm.config.serverUser || 'root'}
                    onChange={e => setInstanceForm({
                      ...instanceForm,
                      config: { ...instanceForm.config, serverUser: e.target.value }
                    })}
                    sx={{ width: 120 }}
                  />
                  <TextField
                    label="SSH 端口"
                    type="number"
                    value={instanceForm.config.serverSshPort || 22}
                    onChange={e => setInstanceForm({
                      ...instanceForm,
                      config: { ...instanceForm.config, serverSshPort: parseInt(e.target.value) || 22 }
                    })}
                    sx={{ width: 100 }}
                  />
                </Box>
              )}

              {instanceForm.type === 'cloudflare' && (
                <TextField
                  label="Tunnel Token"
                  value={instanceForm.config.tunnelToken || ''}
                  onChange={e => setInstanceForm({
                    ...instanceForm,
                    config: { ...instanceForm.config, tunnelToken: e.target.value }
                  })}
                  fullWidth
                  placeholder="从 Cloudflare Dashboard 获取"
                  helperText="在 Cloudflare Zero Trust → Tunnels → 创建隧道 → 复制 Token"
                />
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setInstanceDialogOpen(false)}>取消</Button>
            <Button
              variant="contained"
              onClick={selectedInstance ? handleUpdateInstance : handleCreateInstance}
              disabled={!instanceForm.name}
            >
              {selectedInstance ? '更新' : '创建'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ==================== 部署对话框 ==================== */}
        <Dialog open={deployDialogOpen} onClose={() => setDeployDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>部署穿透组件到 {selectedNode?.name}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                选择要部署到此节点的穿透组件:
              </Typography>
              {types.map(t => (
                <FormControlLabel
                  key={t.type}
                  control={
                    <Switch
                      checked={deployForm.components.includes(t.type)}
                      onChange={e => {
                        if (e.target.checked) {
                          setDeployForm({ ...deployForm, components: [...deployForm.components, t.type] });
                        } else {
                          setDeployForm({ ...deployForm, components: deployForm.components.filter(c => c !== t.type) });
                        }
                      }}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2">{t.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{t.description}</Typography>
                    </Box>
                  }
                />
              ))}

              <Divider />

              <FormControl fullWidth>
                <InputLabel>部署角色</InputLabel>
                <Select
                  value={deployForm.role}
                  label="部署角色"
                  onChange={e => setDeployForm({ ...deployForm, role: e.target.value as any })}
                >
                  <MenuItem value="server">服务端</MenuItem>
                  <MenuItem value="client">客户端</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeployDialogOpen(false)}>取消</Button>
            <Button
              variant="contained"
              onClick={handleDeployNode}
              disabled={deployForm.components.length === 0}
            >
              开始部署
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            severity={snackbar.severity}
            onClose={() => setSnackbar({ ...snackbar, open: false })}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </Container>
  );
};

export default PenetrationPage;
