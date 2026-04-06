import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Container, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Button, IconButton, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControl, InputLabel, Select, MenuItem,
  Alert, CircularProgress, Tooltip, Stack
} from '@mui/material';
import {
  Add, Delete, Edit, PlayArrow, Stop, Refresh, Storage, CloudCircle,
  FolderOpen
} from '@mui/icons-material';
import { apiClient } from '../core/api/apiClient';

interface StorageItem {
  id: number;
  name: string;
  type: string;
  mountPath: string;
  status: 'online' | 'offline';
  config: Record<string, any>;
  order: number;
}

interface DriverType {
  type: string;
  name: string;
  description: string;
  configFields: Array<{
    name: string;
    label: string;
    type: string;
    required: boolean;
    default?: any;
    help?: string;
  }>;
}

const driverIcons: Record<string, React.ReactNode> = {
  local: <Storage />,
  s3: <CloudCircle />,
  webdav: <CloudCircle />,
  ftp: <CloudCircle />,
  sftp: <CloudCircle />,
  smb: <FolderOpen />,
  aliyundrive: <CloudCircle />,
  onedrive: <CloudCircle />,
  googledrive: <CloudCircle />,
  baidu: <CloudCircle />,
  jianguoyun: <CloudCircle />,
};

const StorageManagePage: React.FC = () => {
  const [storages, setStorages] = useState<StorageItem[]>([]);
  const [driverTypes, setDriverTypes] = useState<DriverType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'local',
    mountPath: '/',
    config: {} as Record<string, any>,
  });

  const fetchData = async () => {
    setLoading(true);
    const [storageRes, driverRes] = await Promise.all([
      apiClient.get<any>('/storages'),
      apiClient.get<any>('/driver-types'),
    ]);
    if (storageRes.data) setStorages(storageRes.data.data || []);
    if (driverRes.data) setDriverTypes(driverRes.data.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const selectedDriver = driverTypes.find(d => d.type === formData.type);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({ name: '', type: 'local', mountPath: '/', config: {} });
    setDialogOpen(true);
  };

  const handleOpenEdit = (s: StorageItem) => {
    setEditingId(s.id);
    setFormData({
      name: s.name,
      type: s.type,
      mountPath: s.mountPath,
      config: typeof s.config === 'string' ? JSON.parse(s.config) : s.config,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) { setError('Name is required'); return; }
    const payload = { ...formData };
    let res;
    if (editingId) {
      res = await apiClient.put(`/storages/${editingId}`, payload);
    } else {
      res = await apiClient.post('/storages', payload);
    }
    if (res.error) {
      setError(res.error);
    } else {
      setDialogOpen(false);
      fetchData();
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this storage?')) return;
    await apiClient.delete(`/storages/${id}`);
    fetchData();
  };

  const handleEnable = async (id: number) => {
    const res = await apiClient.post(`/storages/${id}/enable`, {});
    if (res.error) setError(res.error);
    else fetchData();
  };

  const handleDisable = async (id: number) => {
    await apiClient.post(`/storages/${id}/disable`, {});
    fetchData();
  };

  const updateConfigField = (fieldName: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      config: { ...prev.config, [fieldName]: value },
    }));
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Storage Management
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<Refresh />} onClick={fetchData}>Refresh</Button>
            <Button variant="contained" startIcon={<Add />} onClick={handleOpenCreate}>Add Storage</Button>
          </Stack>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Driver</TableCell>
                  <TableCell>Mount Path</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {storages.length === 0 ? (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No storages configured. Click "Add Storage" to create one.
                  </TableCell></TableRow>
                ) : storages.map(s => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {driverIcons[s.type] || <Storage />}
                        {s.name}
                      </Box>
                    </TableCell>
                    <TableCell><Chip label={s.type} size="small" variant="outlined" /></TableCell>
                    <TableCell>{s.mountPath}</TableCell>
                    <TableCell>
                      <Chip label={s.status} size="small" color={s.status === 'online' ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell align="right">
                      {s.status === 'offline' ? (
                        <Tooltip title="Enable"><IconButton color="success" onClick={() => handleEnable(s.id)}><PlayArrow /></IconButton></Tooltip>
                      ) : (
                        <Tooltip title="Disable"><IconButton color="warning" onClick={() => handleDisable(s.id)}><Stop /></IconButton></Tooltip>
                      )}
                      <Tooltip title="Edit"><IconButton onClick={() => handleOpenEdit(s)}><Edit /></IconButton></Tooltip>
                      <Tooltip title="Delete"><IconButton color="error" onClick={() => handleDelete(s.id)}><Delete /></IconButton></Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Edit Storage' : 'Add Storage'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField label="Name" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} fullWidth required />
            <FormControl fullWidth>
              <InputLabel>Driver Type</InputLabel>
              <Select value={formData.type} label="Driver Type" onChange={e => setFormData(p => ({ ...p, type: e.target.value, config: {} }))}>
                {driverTypes.map(d => (
                  <MenuItem key={d.type} value={d.type}>
                    {d.name} — {d.description}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField label="Mount Path" value={formData.mountPath} onChange={e => setFormData(p => ({ ...p, mountPath: e.target.value }))} fullWidth />
            {selectedDriver?.configFields.map(f => (
              <TextField
                key={f.name}
                label={f.label}
                type={f.type === 'password' ? 'password' : f.type === 'number' ? 'number' : 'text'}
                value={formData.config[f.name] || f.default || ''}
                onChange={e => updateConfigField(f.name, e.target.value)}
                fullWidth
                required={f.required}
                helperText={f.help}
                multiline={f.type === 'textarea'}
                rows={f.type === 'textarea' ? 3 : 1}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>{editingId ? 'Save' : 'Create'}</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default StorageManagePage;
