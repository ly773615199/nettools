/**
 * 用户管理页面 [G8]
 * admin 专属 - 用户列表 / 角色分配 / 创建删除
 */
import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Container, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Button, IconButton, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControl, InputLabel, Select, MenuItem, Alert, Stack
} from '@mui/material';
import { Add, Delete, Edit, Refresh, Lock } from '@mui/icons-material';
import { apiClient } from '../core/api/apiClient';

interface UserItem {
  id: number; username: string; role: string; createdAt: string;
}

const UserManagePage: React.FC = () => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialog, setEditDialog] = useState<{ open: boolean; user: UserItem | null }>({ open: false, user: null });
  const [createForm, setCreateForm] = useState({ username: '', password: '', role: 'user' });
  const [editForm, setEditForm] = useState({ password: '', role: '' });

  const load = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/api/users');
      setUsers(res.data.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    try {
      if (!createForm.username || !createForm.password) {
        setError('Username and password are required');
        return;
      }
      await apiClient.post('/api/users', createForm);
      setDialogOpen(false);
      setCreateForm({ username: '', password: '', role: 'user' });
      setSuccess('User created');
      load();
    } catch (err: any) { setError(err.message); }
  };

  const handleEdit = async () => {
    if (!editDialog.user) return;
    try {
      const updates: any = {};
      if (editForm.password) updates.password = editForm.password;
      if (editForm.role) updates.role = editForm.role;
      await apiClient.put(`/api/users/${editDialog.user.id}`, updates);
      setEditDialog({ open: false, user: null });
      setSuccess('User updated');
      load();
    } catch (err: any) { setError(err.message); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure?')) return;
    try {
      await apiClient.delete(`/api/users/${id}`);
      setSuccess('User deleted');
      load();
    } catch (err: any) { setError(err.message); }
  };

  const roleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'error';
      case 'user': return 'primary';
      case 'guest': return 'default';
      default: return 'default';
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">User Management</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<Refresh />} onClick={load}>Refresh</Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => { setCreateForm({ username: '', password: '', role: 'user' }); setDialogOpen(true); }}>
            New User
          </Button>
        </Stack>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Username</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.id}</TableCell>
                <TableCell>{u.username}</TableCell>
                <TableCell><Chip label={u.role} size="small" color={roleColor(u.role) as any} /></TableCell>
                <TableCell>{u.createdAt ? new Date(u.createdAt).toLocaleString() : '-'}</TableCell>
                <TableCell>
                  <IconButton onClick={() => { setEditForm({ password: '', role: u.role }); setEditDialog({ open: true, user: u }); }}>
                    <Edit />
                  </IconButton>
                  <IconButton color="error" onClick={() => handleDelete(u.id)}><Delete /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Create User</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Username" fullWidth value={createForm.username}
              onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })} />
            <TextField label="Password" type="password" fullWidth value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select value={createForm.role} label="Role"
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}>
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="user">User</MenuItem>
                <MenuItem value="guest">Guest</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialog.open} onClose={() => setEditDialog({ open: false, user: null })} maxWidth="xs" fullWidth>
        <DialogTitle>Edit User: {editDialog.user?.username}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="New Password (leave empty to keep)" type="password" fullWidth value={editForm.password}
              onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select value={editForm.role} label="Role"
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="user">User</MenuItem>
                <MenuItem value="guest">Guest</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog({ open: false, user: null })}>Cancel</Button>
          <Button onClick={handleEdit} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default UserManagePage;
