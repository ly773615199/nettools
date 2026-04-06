import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Container, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Button, IconButton, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Alert, CircularProgress, LinearProgress, Tooltip, Stack
} from '@mui/material';
import { Add, Delete, Cancel, Refresh, Download, OpenInNew } from '@mui/icons-material';
import { apiClient } from '../core/api/apiClient';

interface DownloadTask {
  id: number;
  url: string;
  filename: string;
  size: number;
  downloaded: number;
  status: string;
  progress: number;
  speed: string;
  error: string;
  createdAt: string;
}

interface DownloadedFile {
  name: string;
  size: number;
  modified: string;
  downloadUrl: string;
}

const formatSize = (bytes: number) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
};

const statusColor: Record<string, 'warning' | 'info' | 'success' | 'error' | 'default'> = {
  pending: 'warning',
  downloading: 'info',
  completed: 'success',
  failed: 'error',
  cancelled: 'default',
};

const DownloadPage: React.FC = () => {
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [files, setFiles] = useState<DownloadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newFilename, setNewFilename] = useState('');

  const fetchData = async () => {
    setLoading(true);
    const [tasksRes, filesRes] = await Promise.all([
      apiClient.get<any>('/downloads'),
      apiClient.get<any>('/downloads-files'),
    ]);
    if (tasksRes.data) setTasks(tasksRes.data.data || []);
    if (filesRes.data) setFiles(filesRes.data.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCreate = async () => {
    if (!newUrl) { setError('URL is required'); return; }
    const res = await apiClient.post('/downloads', {
      url: newUrl,
      filename: newFilename || undefined,
    });
    if (res.error) {
      setError(res.error);
    } else {
      setDialogOpen(false);
      setNewUrl('');
      setNewFilename('');
      fetchData();
    }
  };

  const handleCancel = async (id: number) => {
    await apiClient.post(`/downloads/${id}/cancel`, {});
    fetchData();
  };

  const handleDelete = async (id: number) => {
    await apiClient.delete(`/downloads/${id}`);
    fetchData();
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">Download Manager</Typography>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<Refresh />} onClick={fetchData}>Refresh</Button>
            <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>New Download</Button>
          </Stack>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        {/* Active Tasks */}
        <Typography variant="h6" sx={{ mb: 2 }}>Active Tasks</Typography>
        <TableContainer component={Paper} sx={{ mb: 4 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Filename</TableCell>
                <TableCell>URL</TableCell>
                <TableCell>Size</TableCell>
                <TableCell>Progress</TableCell>
                <TableCell>Speed</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tasks.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No download tasks.
                </TableCell></TableRow>
              ) : tasks.map(t => (
                <TableRow key={t.id}>
                  <TableCell>{t.filename || t.url.split('/').pop()}</TableCell>
                  <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Tooltip title={t.url}><span>{t.url}</span></Tooltip>
                  </TableCell>
                  <TableCell>{formatSize(t.size)}</TableCell>
                  <TableCell sx={{ minWidth: 150 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress variant="determinate" value={t.progress || 0} sx={{ flexGrow: 1 }} />
                      <Typography variant="caption">{(t.progress || 0).toFixed(0)}%</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{t.speed || '-'}</TableCell>
                  <TableCell><Chip label={t.status} size="small" color={statusColor[t.status] || 'default'} /></TableCell>
                  <TableCell align="right">
                    {(t.status === 'downloading' || t.status === 'pending') && (
                      <Tooltip title="Cancel"><IconButton color="warning" onClick={() => handleCancel(t.id)}><Cancel /></IconButton></Tooltip>
                    )}
                    <Tooltip title="Delete"><IconButton color="error" onClick={() => handleDelete(t.id)}><Delete /></IconButton></Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Downloaded Files */}
        <Typography variant="h6" sx={{ mb: 2 }}>Downloaded Files</Typography>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Size</TableCell>
                <TableCell>Modified</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {files.length === 0 ? (
                <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No downloaded files.
                </TableCell></TableRow>
              ) : files.map((f, i) => (
                <TableRow key={i}>
                  <TableCell>{f.name}</TableCell>
                  <TableCell>{formatSize(f.size)}</TableCell>
                  <TableCell>{f.modified ? new Date(f.modified).toLocaleString() : '-'}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Download">
                      <IconButton color="primary" href={`${f.downloadUrl}`} target="_blank">
                        <Download />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* New Download Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Download</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField label="URL" value={newUrl} onChange={e => setNewUrl(e.target.value)} fullWidth required placeholder="https://example.com/file.zip" />
            <TextField label="Filename (optional)" value={newFilename} onChange={e => setNewFilename(e.target.value)} fullWidth placeholder="Auto-detect from URL" />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate}>Download</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default DownloadPage;
