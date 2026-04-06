/**
 * VPN 管理页面 [G5]
 * WireGuard / OpenVPN 服务器管理
 */
import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Container, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Button, IconButton, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControl, InputLabel, Select, MenuItem, Alert, Stack, Tooltip, Divider
} from '@mui/material';
import { Add, Delete, PlayArrow, Stop, Refresh, Download, QrCode } from '@mui/icons-material';
import { apiClient } from '../core/api/apiClient';

interface VpnServer {
  id: number;
  name: string;
  type: string;
  host: string;
  port: number;
  protocol: string;
  subnet: string;
  dns: string;
  status: string;
  running?: boolean;
  uptime?: string;
}

interface VpnTools { wireguard: boolean; openvpn: boolean; }

const VpnManagePage: React.FC = () => {
  const [servers, setServers] = useState<VpnServer[]>([]);
  const [tools, setTools] = useState<VpnTools>({ wireguard: false, openvpn: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [configDialog, setConfigDialog] = useState<{ open: boolean; config: string; type: string }>({ open: false, config: '', type: '' });
  const [formData, setFormData] = useState({
    name: '', type: 'wireguard', host: '0.0.0.0', port: 51820,
    protocol: 'udp', subnet: '10.8.0.0/24', dns: '8.8.8.8',
  });

  const load = async () => {
    try {
      setLoading(true);
      const [srvRes, toolsRes] = await Promise.all([
        apiClient.get('/api/vpn/servers'),
        apiClient.get('/api/vpn/tools'),
      ]);
      setServers(srvRes.data.data || []);
      setTools(toolsRes.data.data || { wireguard: false, openvpn: false });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    try {
      await apiClient.post('/api/vpn/servers', formData);
      setDialogOpen(false);
      load();
    } catch (err: any) { setError(err.message); }
  };

  const handleConnect = async (id: number) => {
    try { await apiClient.post(`/api/vpn/servers/${id}/connect`); load(); }
    catch (err: any) { setError(err.message); }
  };

  const handleDisconnect = async (id: number) => {
    try { await apiClient.post(`/api/vpn/servers/${id}/disconnect`); load(); }
    catch (err: any) { setError(err.message); }
  };

  const handleDelete = async (id: number) => {
    try { await apiClient.delete(`/api/vpn/servers/${id}`); load(); }
    catch (err: any) { setError(err.message); }
  };

  const handleShowConfig = async (id: number) => {
    try {
      const res = await apiClient.get(`/api/vpn/servers/${id}/config`);
      setConfigDialog({ open: true, config: res.data.data.config, type: res.data.data.type });
    } catch (err: any) { setError(err.message); }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">VPN Servers</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<Refresh />} onClick={load}>Refresh</Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => { setFormData({ name: '', type: 'wireguard', host: '0.0.0.0', port: 51820, protocol: 'udp', subnet: '10.8.0.0/24', dns: '8.8.8.8' }); setDialogOpen(true); }}>
            New VPN
          </Button>
        </Stack>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2">System Tools</Typography>
        <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
          <Chip label={`WireGuard: ${tools.wireguard ? 'Available' : 'Not installed'}`}
            color={tools.wireguard ? 'success' : 'default'} size="small" />
          <Chip label={`OpenVPN: ${tools.openvpn ? 'Available' : 'Not installed'}`}
            color={tools.openvpn ? 'success' : 'default'} size="small" />
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Endpoint</TableCell>
              <TableCell>Subnet</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {servers.length === 0 && !loading && (
              <TableRow><TableCell colSpan={6} align="center">No VPN servers</TableCell></TableRow>
            )}
            {servers.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.name}</TableCell>
                <TableCell><Chip label={s.type} size="small" color={s.type === 'wireguard' ? 'primary' : 'secondary'} /></TableCell>
                <TableCell>{s.host}:{s.port}/{s.protocol}</TableCell>
                <TableCell>{s.subnet}</TableCell>
                <TableCell>
                  <Chip label={s.running ? `Running${s.uptime ? ` (${s.uptime})` : ''}` : s.status}
                    color={s.running ? 'success' : 'default'} size="small" />
                </TableCell>
                <TableCell>
                  {s.running ? (
                    <IconButton color="error" onClick={() => handleDisconnect(s.id)}><Stop /></IconButton>
                  ) : (
                    <IconButton color="success" onClick={() => handleConnect(s.id)}><PlayArrow /></IconButton>
                  )}
                  <IconButton onClick={() => handleShowConfig(s.id)}><Download /></IconButton>
                  <IconButton color="error" onClick={() => handleDelete(s.id)}><Delete /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create VPN Server</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" fullWidth value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select value={formData.type} label="Type"
                onChange={(e) => setFormData({ ...formData, type: e.target.value, port: e.target.value === 'wireguard' ? 51820 : 1194 })}>
                <MenuItem value="wireguard">WireGuard</MenuItem>
                <MenuItem value="openvpn">OpenVPN</MenuItem>
              </Select>
            </FormControl>
            <TextField label="Host" fullWidth value={formData.host}
              onChange={(e) => setFormData({ ...formData, host: e.target.value })} />
            <TextField label="Port" type="number" fullWidth value={formData.port}
              onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) })} />
            <TextField label="Subnet" fullWidth value={formData.subnet}
              onChange={(e) => setFormData({ ...formData, subnet: e.target.value })} />
            <TextField label="DNS" fullWidth value={formData.dns}
              onChange={(e) => setFormData({ ...formData, dns: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

      {/* Config Dialog */}
      <Dialog open={configDialog.open} onClose={() => setConfigDialog({ ...configDialog, open: false })} maxWidth="md" fullWidth>
        <DialogTitle>VPN Client Config ({configDialog.type})</DialogTitle>
        <DialogContent>
          <TextField multiline fullWidth minRows={15} value={configDialog.config} InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: 13 } }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => navigator.clipboard.writeText(configDialog.config)}>Copy</Button>
          <Button onClick={() => setConfigDialog({ ...configDialog, open: false })}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default VpnManagePage;
