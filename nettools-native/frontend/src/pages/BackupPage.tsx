/**
 * 备份管理页面 [G9]
 * 备份任务创建/管理/执行历史
 */
import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Container, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Button, IconButton, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControl, InputLabel, Select, MenuItem, Alert, Stack, LinearProgress
} from '@mui/material';
import { Add, Delete, PlayArrow, Refresh, History } from '@mui/icons-material';
import { apiClient } from '../core/api/apiClient';

interface Storage { id: number; name: string; type: string; }
interface BackupTask {
  id: number; name: string;
  sourceStorage: Storage; targetStorage: Storage;
  sourcePath: string; targetPath: string;
  schedule: string; mode: string;
  status: string; lastRun: string | null;
  running?: boolean;
}
interface Snapshot {
  id: number; fileCount: number; totalSize: number; duration: number; createdAt: string;
}

const BackupPage: React.FC = () => {
  const [tasks, setTasks] = useState<BackupTask[]>([]);
  const [storages, setStorages] = useState<Storage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyDialog, setHistoryDialog] = useState<{ open: boolean; taskId: number; snapshots: Snapshot[] }>({ open: false, taskId: 0, snapshots: [] });
  const [formData, setFormData] = useState({
    name: '', sourceStorageId: 0, targetStorageId: 0,
    sourcePath: '/', targetPath: '/', mode: 'incremental', schedule: '',
  });

  const load = async () => {
    try {
      setLoading(true);
      const [taskRes, storRes] = await Promise.all([
        apiClient.get('/api/backup/tasks'),
        apiClient.get('/api/storages'),
      ]);
      setTasks(taskRes.data.data || []);
      setStorages((storRes.data.data || storRes.data) as Storage[]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    try {
      await apiClient.post('/api/backup/tasks', formData);
      setDialogOpen(false);
      load();
    } catch (err: any) { setError(err.message); }
  };

  const handleExecute = async (id: number) => {
    try { await apiClient.post(`/api/backup/tasks/${id}/execute`); load(); }
    catch (err: any) { setError(err.message); }
  };

  const handleDelete = async (id: number) => {
    try { await apiClient.delete(`/api/backup/tasks/${id}`); load(); }
    catch (err: any) { setError(err.message); }
  };

  const handleShowHistory = async (taskId: number) => {
    try {
      const res = await apiClient.get(`/api/backup/tasks/${taskId}/history`);
      setHistoryDialog({ open: true, taskId, snapshots: res.data.data || [] });
    } catch (err: any) { setError(err.message); }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">Backup Tasks</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<Refresh />} onClick={load}>Refresh</Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => { setFormData({ name: '', sourceStorageId: 0, targetStorageId: 0, sourcePath: '/', targetPath: '/', mode: 'incremental', schedule: '' }); setDialogOpen(true); }}>
            New Task
          </Button>
        </Stack>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Source → Target</TableCell>
              <TableCell>Paths</TableCell>
              <TableCell>Mode</TableCell>
              <TableCell>Schedule</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last Run</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tasks.length === 0 && !loading && (
              <TableRow><TableCell colSpan={8} align="center">No backup tasks</TableCell></TableRow>
            )}
            {tasks.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.name}</TableCell>
                <TableCell>
                  {t.sourceStorage?.name || `#${t.sourceStorage?.id}`} → {t.targetStorage?.name || `#${t.targetStorage?.id}`}
                </TableCell>
                <TableCell sx={{ fontSize: 12 }}>{t.sourcePath} → {t.targetPath}</TableCell>
                <TableCell><Chip label={t.mode} size="small" color={t.mode === 'full' ? 'secondary' : 'primary'} /></TableCell>
                <TableCell>{t.schedule || 'Manual'}</TableCell>
                <TableCell>
                  <Chip label={t.running ? 'Running' : t.status} size="small"
                    color={t.status === 'completed' ? 'success' : t.status === 'error' ? 'error' : t.running ? 'info' : 'default'} />
                </TableCell>
                <TableCell>{t.lastRun ? new Date(t.lastRun).toLocaleString() : '-'}</TableCell>
                <TableCell>
                  <IconButton onClick={() => handleExecute(t.id)} disabled={!!t.running}><PlayArrow /></IconButton>
                  <IconButton onClick={() => handleShowHistory(t.id)}><History /></IconButton>
                  <IconButton color="error" onClick={() => handleDelete(t.id)}><Delete /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Backup Task</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Task Name" fullWidth value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            <FormControl fullWidth>
              <InputLabel>Source Storage</InputLabel>
              <Select value={formData.sourceStorageId} label="Source Storage"
                onChange={(e) => setFormData({ ...formData, sourceStorageId: Number(e.target.value) })}>
                {storages.map(s => <MenuItem key={s.id} value={s.id}>{s.name} ({s.type})</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Target Storage</InputLabel>
              <Select value={formData.targetStorageId} label="Target Storage"
                onChange={(e) => setFormData({ ...formData, targetStorageId: Number(e.target.value) })}>
                {storages.map(s => <MenuItem key={s.id} value={s.id}>{s.name} ({s.type})</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Source Path" fullWidth value={formData.sourcePath}
              onChange={(e) => setFormData({ ...formData, sourcePath: e.target.value })} />
            <TextField label="Target Path" fullWidth value={formData.targetPath}
              onChange={(e) => setFormData({ ...formData, targetPath: e.target.value })} />
            <FormControl fullWidth>
              <InputLabel>Mode</InputLabel>
              <Select value={formData.mode} label="Mode"
                onChange={(e) => setFormData({ ...formData, mode: e.target.value })}>
                <MenuItem value="incremental">Incremental</MenuItem>
                <MenuItem value="full">Full</MenuItem>
              </Select>
            </FormControl>
            <TextField label="Schedule (cron, optional)" fullWidth value={formData.schedule}
              placeholder="e.g. 0 2 * * * (daily at 2am)"
              onChange={(e) => setFormData({ ...formData, schedule: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyDialog.open} onClose={() => setHistoryDialog({ ...historyDialog, open: false })} maxWidth="md" fullWidth>
        <DialogTitle>Backup History</DialogTitle>
        <DialogContent>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Files</TableCell>
                <TableCell>Size</TableCell>
                <TableCell>Duration</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {historyDialog.snapshots.length === 0 && <TableRow><TableCell colSpan={4} align="center">No history</TableCell></TableRow>}
              {historyDialog.snapshots.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{new Date(s.createdAt).toLocaleString()}</TableCell>
                  <TableCell>{s.fileCount}</TableCell>
                  <TableCell>{formatSize(s.totalSize)}</TableCell>
                  <TableCell>{formatDuration(s.duration)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryDialog({ ...historyDialog, open: false })}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default BackupPage;
