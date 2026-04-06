import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Container, Paper, Card, CardContent, Button, IconButton,
  Alert, CircularProgress, Tooltip, Stack, Switch, FormControlLabel,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Divider
} from '@mui/material';
import {
  Refresh, PlayArrow, Stop, Shield, Router,
  Security, VpnLock, Public
} from '@mui/icons-material';
import { apiClient } from '../core/api/apiClient';

interface SystemProxyStatus {
  enabled: boolean;
  method?: string;
}

interface ClashStatus {
  running: boolean;
  hasBinary: boolean;
}

interface TunnelServer {
  id: number;
  name: string;
  host: string;
  port: number;
  secret: string;
  minPort: number;
  maxPort: number;
  status: string;
  running: boolean;
}

const SystemProxyPage: React.FC = () => {
  const [systemProxy, setSystemProxy] = useState<SystemProxyStatus>({ enabled: false });
  const [clashStatus, setClashStatus] = useState<ClashStatus>({ running: false, hasBinary: false });
  const [servers, setServers] = useState<TunnelServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchData = async () => {
    setLoading(true);
    const [proxyRes, clashRes, serversRes] = await Promise.all([
      apiClient.get<any>('/system-proxy/status'),
      apiClient.get<any>('/clash/status'),
      apiClient.get<any>('/tunnel-servers'),
    ]);
    if (proxyRes.data) setSystemProxy(proxyRes.data.data || { enabled: false });
    if (clashRes.data) setClashStatus(clashRes.data.data || { running: false });
    if (serversRes.data) setServers(serversRes.data.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const toggleSystemProxy = async () => {
    if (systemProxy.enabled) {
      const res = await apiClient.post('/system-proxy/disable', {});
      if (res.error) setError(res.error);
      else setSuccess('System proxy disabled');
    } else {
      const res = await apiClient.post('/system-proxy/enable', { host: '127.0.0.1', port: 7890 });
      if (res.error) setError(res.error);
      else setSuccess('System proxy enabled');
    }
    fetchData();
  };

  const startClash = async () => {
    const res = await apiClient.post('/clash/start', {});
    if (res.error) setError(res.error);
    else setSuccess('Clash started');
    fetchData();
  };

  const stopClash = async () => {
    const res = await apiClient.post('/clash/stop', {});
    if (res.error) setError(res.error);
    else setSuccess('Clash stopped');
    fetchData();
  };

  const startServer = async (id: number) => {
    const res = await apiClient.post(`/tunnel-servers/${id}/start`, {});
    if (res.error) setError(res.error);
    else setSuccess('Server started');
    fetchData();
  };

  const stopServer = async (id: number) => {
    const res = await apiClient.post(`/tunnel-servers/${id}/stop`, {});
    if (res.error) setError(res.error);
    else setSuccess('Server stopped');
    fetchData();
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">System Proxy & Services</Typography>
          <Button variant="outlined" startIcon={<Refresh />} onClick={fetchData}>Refresh</Button>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Clash Proxy */}
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Shield sx={{ fontSize: 40, color: clashStatus.running ? 'success.main' : 'text.secondary' }} />
                    <Box>
                      <Typography variant="h6">Clash Proxy</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Mixed proxy on port 7890
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Chip label={clashStatus.running ? 'Running' : 'Stopped'} color={clashStatus.running ? 'success' : 'default'} />
                    {clashStatus.running ? (
                      <Button variant="outlined" color="warning" startIcon={<Stop />} onClick={stopClash}>Stop</Button>
                    ) : (
                      <Button variant="contained" startIcon={<PlayArrow />} onClick={startClash}>Start</Button>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {/* System Proxy */}
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Security sx={{ fontSize: 40, color: systemProxy.enabled ? 'success.main' : 'text.secondary' }} />
                    <Box>
                      <Typography variant="h6">System Proxy</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {systemProxy.method ? `Method: ${systemProxy.method}` : 'System-level HTTP/HTTPS/SOCKS proxy'}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Chip label={systemProxy.enabled ? 'Enabled' : 'Disabled'} color={systemProxy.enabled ? 'success' : 'default'} />
                    <FormControlLabel
                      control={<Switch checked={systemProxy.enabled} onChange={toggleSystemProxy} />}
                      label={systemProxy.enabled ? 'ON' : 'OFF'}
                    />
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {/* Bore Tunnel Servers */}
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Router sx={{ fontSize: 40, color: 'primary.main' }} />
                    <Box>
                      <Typography variant="h6">Bore Tunnel Servers</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Self-hosted tunnel relay servers
                      </Typography>
                    </Box>
                  </Box>
                </Box>
                <Divider sx={{ mb: 2 }} />
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Bind</TableCell>
                        <TableCell>Port Range</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {servers.length === 0 ? (
                        <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                          No tunnel servers configured. Create one from the API or storage management.
                        </TableCell></TableRow>
                      ) : servers.map(s => (
                        <TableRow key={s.id}>
                          <TableCell>{s.name}</TableCell>
                          <TableCell>{s.host}:{s.port}</TableCell>
                          <TableCell>{s.minPort} - {s.maxPort}</TableCell>
                          <TableCell>
                            <Chip label={s.running ? 'Running' : s.status} size="small" color={s.running ? 'success' : 'default'} />
                          </TableCell>
                          <TableCell align="right">
                            {s.running ? (
                              <Tooltip title="Stop"><IconButton color="warning" size="small" onClick={() => stopServer(s.id)}><Stop /></IconButton></Tooltip>
                            ) : (
                              <Tooltip title="Start"><IconButton color="success" size="small" onClick={() => startServer(s.id)}><PlayArrow /></IconButton></Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Box>
        )}
      </Box>
    </Container>
  );
};

export default SystemProxyPage;
