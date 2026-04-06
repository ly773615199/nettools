import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Container, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Button, IconButton, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel,
  Alert, CircularProgress, Tooltip, Stack, Tabs, Tab, Divider
} from '@mui/material';
import { Add, Delete, Edit, Refresh, PlayArrow, Stop, Rule, Groups, Upload, Download } from '@mui/icons-material';
import { apiClient } from '../core/api/apiClient';

// ========== Types ==========
interface ProxyRule {
  id: number;
  type: string;
  value: string;
  proxy: string;
  priority: number;
  enabled: boolean;
}

interface ProxyGroup {
  id: number;
  name: string;
  type: string;
  proxies: string[];
  url: string;
  interval: number;
  enabled: boolean;
}

interface ProxyItem {
  id: number;
  name: string;
  type: string;
  server: string;
  port: number;
  status: string;
}

const ruleTypes = ['DOMAIN-SUFFIX', 'DOMAIN-KEYWORD', 'DOMAIN', 'IP-CIDR', 'IP-CIDR6', 'GEOIP', 'PROCESS-NAME', 'MATCH'];
const groupTypes = ['select', 'url-test', 'fallback', 'load-balance'];

const ClashRulesPage: React.FC = () => {
  const [tab, setTab] = useState(0);
  const [rules, setRules] = useState<ProxyRule[]>([]);
  const [groups, setGroups] = useState<ProxyGroup[]>([]);
  const [proxies, setProxies] = useState<ProxyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Rule dialog
  const [ruleDialog, setRuleDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<ProxyRule | null>(null);
  const [ruleForm, setRuleForm] = useState({ type: 'DOMAIN-SUFFIX', value: '', proxy: 'DIRECT', priority: 0, enabled: true });

  // Group dialog
  const [groupDialog, setGroupDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ProxyGroup | null>(null);
  const [groupForm, setGroupForm] = useState({ name: '', type: 'select', proxies: [] as string[], url: 'http://www.gstatic.com/generate_204', interval: 300, enabled: true });

  const fetchData = async () => {
    setLoading(true);
    const [rulesRes, groupsRes, proxiesRes] = await Promise.all([
      apiClient.get<any>('/clash/rules'),
      apiClient.get<any>('/clash/groups'),
      apiClient.get<any>('/proxies'),
    ]);
    if (rulesRes.data) setRules(rulesRes.data.data || []);
    if (groupsRes.data) setGroups(groupsRes.data.data || []);
    if (proxiesRes.data) setProxies(proxiesRes.data.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Rule handlers
  const openRuleDialog = (rule?: ProxyRule) => {
    if (rule) {
      setEditingRule(rule);
      setRuleForm({ type: rule.type, value: rule.value, proxy: rule.proxy, priority: rule.priority, enabled: rule.enabled });
    } else {
      setEditingRule(null);
      setRuleForm({ type: 'DOMAIN-SUFFIX', value: '', proxy: 'DIRECT', priority: 0, enabled: true });
    }
    setRuleDialog(true);
  };

  const saveRule = async () => {
    if (!ruleForm.value) { setError('Value is required'); return; }
    const res = editingRule
      ? await apiClient.put(`/clash/rules/${editingRule.id}`, ruleForm)
      : await apiClient.post('/clash/rules', ruleForm);
    if (res.error) { setError(res.error); return; }
    setRuleDialog(false);
    setSuccess(editingRule ? 'Rule updated' : 'Rule created');
    fetchData();
  };

  const deleteRule = async (id: number) => {
    await apiClient.delete(`/clash/rules/${id}`);
    fetchData();
  };

  // Group handlers
  const openGroupDialog = (group?: ProxyGroup) => {
    if (group) {
      setEditingGroup(group);
      setGroupForm({ name: group.name, type: group.type, proxies: Array.isArray(group.proxies) ? group.proxies : [], url: group.url, interval: group.interval, enabled: group.enabled });
    } else {
      setEditingGroup(null);
      setGroupForm({ name: '', type: 'select', proxies: [], url: 'http://www.gstatic.com/generate_204', interval: 300, enabled: true });
    }
    setGroupDialog(true);
  };

  const saveGroup = async () => {
    if (!groupForm.name) { setError('Name is required'); return; }
    const res = editingGroup
      ? await apiClient.put(`/clash/groups/${editingGroup.id}`, groupForm)
      : await apiClient.post('/clash/groups', groupForm);
    if (res.error) { setError(res.error); return; }
    setGroupDialog(false);
    setSuccess(editingGroup ? 'Group updated' : 'Group created');
    fetchData();
  };

  const deleteGroup = async (id: number) => {
    await apiClient.delete(`/clash/groups/${id}`);
    fetchData();
  };

  // Generate config
  const generateConfig = async () => {
    const res = await apiClient.post('/clash/generate', { mode: 'Rule' });
    if (res.error) setError(res.error);
    else setSuccess('Clash config generated successfully');
  };

  const proxyNames = proxies.map(p => p.name);

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">Clash Rules & Groups</Typography>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<Refresh />} onClick={fetchData}>Refresh</Button>
            <Button variant="contained" onClick={generateConfig}>Generate Config</Button>
          </Stack>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab icon={<Rule />} label="Rules" />
          <Tab icon={<Groups />} label="Groups" />
        </Tabs>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : tab === 0 ? (
          <>
            <Box sx={{ mb: 2 }}>
              <Button variant="contained" startIcon={<Add />} onClick={() => openRuleDialog()}>Add Rule</Button>
            </Box>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Value</TableCell>
                    <TableCell>Proxy</TableCell>
                    <TableCell>Priority</TableCell>
                    <TableCell>Enabled</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rules.length === 0 ? (
                    <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>No rules configured.</TableCell></TableRow>
                  ) : rules.map(r => (
                    <TableRow key={r.id}>
                      <TableCell><Chip label={r.type} size="small" /></TableCell>
                      <TableCell>{r.value}</TableCell>
                      <TableCell>{r.proxy}</TableCell>
                      <TableCell>{r.priority}</TableCell>
                      <TableCell><Chip label={r.enabled ? 'ON' : 'OFF'} size="small" color={r.enabled ? 'success' : 'default'} /></TableCell>
                      <TableCell align="right">
                        <Tooltip title="Edit"><IconButton onClick={() => openRuleDialog(r)}><Edit /></IconButton></Tooltip>
                        <Tooltip title="Delete"><IconButton color="error" onClick={() => deleteRule(r.id)}><Delete /></IconButton></Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        ) : (
          <>
            <Box sx={{ mb: 2 }}>
              <Button variant="contained" startIcon={<Add />} onClick={() => openGroupDialog()}>Add Group</Button>
            </Box>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Proxies</TableCell>
                    <TableCell>Health Check</TableCell>
                    <TableCell>Enabled</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {groups.length === 0 ? (
                    <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>No proxy groups configured.</TableCell></TableRow>
                  ) : groups.map(g => (
                    <TableRow key={g.id}>
                      <TableCell>{g.name}</TableCell>
                      <TableCell><Chip label={g.type} size="small" /></TableCell>
                      <TableCell sx={{ maxWidth: 200 }}>
                        {(Array.isArray(g.proxies) ? g.proxies : []).join(', ') || '-'}
                      </TableCell>
                      <TableCell>{g.type === 'select' ? '-' : `every ${g.interval}s`}</TableCell>
                      <TableCell><Chip label={g.enabled ? 'ON' : 'OFF'} size="small" color={g.enabled ? 'success' : 'default'} /></TableCell>
                      <TableCell align="right">
                        <Tooltip title="Edit"><IconButton onClick={() => openGroupDialog(g)}><Edit /></IconButton></Tooltip>
                        <Tooltip title="Delete"><IconButton color="error" onClick={() => deleteGroup(g.id)}><Delete /></IconButton></Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </Box>

      {/* Rule Dialog */}
      <Dialog open={ruleDialog} onClose={() => setRuleDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingRule ? 'Edit Rule' : 'Add Rule'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select value={ruleForm.type} label="Type" onChange={e => setRuleForm(p => ({ ...p, type: e.target.value }))}>
                {ruleTypes.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Value" value={ruleForm.value} onChange={e => setRuleForm(p => ({ ...p, value: e.target.value }))} fullWidth required placeholder="e.g. google.com" />
            <FormControl fullWidth>
              <InputLabel>Proxy Target</InputLabel>
              <Select value={ruleForm.proxy} label="Proxy Target" onChange={e => setRuleForm(p => ({ ...p, proxy: e.target.value }))}>
                <MenuItem value="DIRECT">DIRECT</MenuItem>
                <MenuItem value="REJECT">REJECT</MenuItem>
                {groups.map(g => <MenuItem key={g.id} value={g.name}>{g.name}</MenuItem>)}
                {proxyNames.map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Priority" type="number" value={ruleForm.priority} onChange={e => setRuleForm(p => ({ ...p, priority: Number(e.target.value) }))} fullWidth />
            <FormControlLabel control={<Switch checked={ruleForm.enabled} onChange={e => setRuleForm(p => ({ ...p, enabled: e.target.checked }))} />} label="Enabled" />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRuleDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveRule}>{editingRule ? 'Save' : 'Create'}</Button>
        </DialogActions>
      </Dialog>

      {/* Group Dialog */}
      <Dialog open={groupDialog} onClose={() => setGroupDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingGroup ? 'Edit Group' : 'Add Group'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField label="Name" value={groupForm.name} onChange={e => setGroupForm(p => ({ ...p, name: e.target.value }))} fullWidth required />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select value={groupForm.type} label="Type" onChange={e => setGroupForm(p => ({ ...p, type: e.target.value }))}>
                {groupTypes.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Proxies</InputLabel>
              <Select multiple value={groupForm.proxies} label="Proxies" onChange={e => setGroupForm(p => ({ ...p, proxies: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value }))}>
                {proxyNames.map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
              </Select>
            </FormControl>
            {groupForm.type !== 'select' && (
              <>
                <TextField label="Health Check URL" value={groupForm.url} onChange={e => setGroupForm(p => ({ ...p, url: e.target.value }))} fullWidth />
                <TextField label="Check Interval (seconds)" type="number" value={groupForm.interval} onChange={e => setGroupForm(p => ({ ...p, interval: Number(e.target.value) }))} fullWidth />
              </>
            )}
            <FormControlLabel control={<Switch checked={groupForm.enabled} onChange={e => setGroupForm(p => ({ ...p, enabled: e.target.checked }))} />} label="Enabled" />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGroupDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveGroup}>{editingGroup ? 'Save' : 'Create'}</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ClashRulesPage;
