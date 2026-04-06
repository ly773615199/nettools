/**
 * 文件服务管理页面 [G1]
 * HTTP/WebDAV 多协议文件访问服务管理
 */
import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Container, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Button, IconButton, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel,
  Alert, Stack, Tooltip, Link
} from '@mui/material';
import { Add, Delete, PlayArrow, Stop, Refresh, ContentCopy } from '@mui/icons-material';
import { apiClient } from '../core/api/apiClient';

interface FileServer {
  key: string;
  type: string;
  port: number;
  uptime: number;
  url: string;
  config: { storageDir: string; auth: boolean };
}

const FileServerPage: React.FC = () => {
  const [servers, setServers] = useState<FileServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    type: 'http', port: 8081, storageDir: '/tmp',
    auth: false, username: '', password: '',
  });

  const loadServers = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/api/fileserver/status');
      setServers(res.data.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadServers(); }, []);

  const handleCreate = async () => {
    try {
      const endpoint = formData.type === 'webdav' ? '/api/fileserver/webdav' : '/api/fileserver/http';
      await apiClient.post(endpoint, formData);
      setDialogOpen(false);
      loadServers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleStop = async (key: string) => {
    try {
      await apiClient.delete(`/api/fileserver/${encodeURIComponent(key)}`);
      loadServers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const formatUptime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">File Servers</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<Refresh />} onClick={loadServers}>Refresh</Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => { setFormData({ type: 'http', port: 8081, storageDir: '/tmp', auth: false, username: '', password: '' }); setDialogOpen(true); }}>
            New Server
          </Button>
        </Stack>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>Port</TableCell>
              <TableCell>URL</TableCell>
              <TableCell>Storage Dir</TableCell>
              <TableCell>Auth</TableCell>
              <TableCell>Uptime</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {servers.length === 0 && !loading && (
              <TableRow><TableCell colSpan={7} align="center">No running servers</TableCell></TableRow>
            )}
            {servers.map((s) => (
              <TableRow key={s.key}>
                <TableCell><Chip label={s.type.toUpperCase()} size="small" color="primary" /></TableCell>
                <TableCell>{s.port}</TableCell>
                <TableCell>
                  <Link href={s.url} target="_blank">{s.url}</Link>
                  <IconButton size="small" onClick={() => navigator.clipboard.writeText(s.url)}>
                    <ContentCopy fontSize="small" />
                  </IconButton>
                </TableCell>
                <TableCell>{s.config.storageDir}</TableCell>
                <TableCell>{s.config.auth ? <Chip label="Yes" size="small" color="success" /> : 'No'}</TableCell>
                <TableCell>{formatUptime(s.uptime)}</TableCell>
                <TableCell>
                  <IconButton color="error" onClick={() => handleStop(s.key)}><Stop /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create File Server</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Protocol</InputLabel>
              <Select value={formData.type} label="Protocol" onChange={(e) => setFormData({ ...formData, type: e.target.value })}>
                <MenuItem value="http">HTTP</MenuItem>
                <MenuItem value="webdav">WebDAV</MenuItem>
              </Select>
            </FormControl>
            <TextField label="Port" type="number" fullWidth value={formData.port}
              onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) })} />
            <TextField label="Storage Directory" fullWidth value={formData.storageDir}
              onChange={(e) => setFormData({ ...formData, storageDir: e.target.value })} />
            <FormControlLabel control={<Switch checked={formData.auth}
              onChange={(e) => setFormData({ ...formData, auth: e.target.checked })} />} label="Enable Authentication" />
            {formData.auth && (
              <>
                <TextField label="Username" fullWidth value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })} />
                <TextField label="Password" type="password" fullWidth value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default FileServerPage;
