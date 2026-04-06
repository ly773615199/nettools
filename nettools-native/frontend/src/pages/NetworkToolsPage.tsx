import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Tabs, Tab, Paper, List, ListItem, ListItemText, ListItemIcon, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Switch, FormControlLabel, CircularProgress, Container } from '@mui/material';
import { Add, NetworkCheck, VpnKey, Settings, PlayArrow, Stop, Delete } from '@mui/icons-material';
import { boreService } from '../core/network/boreService';
import { clashService } from '../core/network/clashService';
import type { Tunnel, Proxy } from '../core/types';
import { t } from '../core/i18n/i18n';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`network-tools-tabpanel-${index}`}
      aria-labelledby={`network-tools-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const NetworkToolsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [openTunnelDialog, setOpenTunnelDialog] = useState(false);
  const [newTunnel, setNewTunnel] = useState({ name: '', localPort: '', remoteServer: '', remotePort: '' });
  const [openProxyDialog, setOpenProxyDialog] = useState(false);
  const [newProxy, setNewProxy] = useState({ name: '', type: 'Shadowsocks', server: '', port: '' });
  const [systemProxyEnabled, setSystemProxyEnabled] = useState(true);
  const [loading, setLoading] = useState(false);

  // 从API获取隧道列表
  useEffect(() => {
    const fetchTunnels = async () => {
      setLoading(true);
      try {
        const res = await boreService.getTunnels();
        setTunnels(res.data || []);
      } catch (error) {
        console.error('Failed to fetch tunnels:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTunnels();
  }, []);

  // 从API获取代理列表
  useEffect(() => {
    const fetchProxies = async () => {
      setLoading(true);
      try {
        const res = await clashService.getProxies();
        setProxies(res.data || []);
      } catch (error) {
        console.error('Failed to fetch proxies:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProxies();
  }, []);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleAddTunnel = () => {
    setOpenTunnelDialog(true);
  };

  const handleSaveTunnel = async () => {
    if (newTunnel.name && newTunnel.localPort && newTunnel.remoteServer) {
      setLoading(true);
      try {
        await boreService.createTunnel({
          name: newTunnel.name,
          localPort: newTunnel.localPort,
          remoteServer: newTunnel.remoteServer,
          remotePort: newTunnel.remotePort,
        });
        // 重新获取隧道列表
        const res = await boreService.getTunnels();
        setTunnels(res.data || []);
        setNewTunnel({ name: '', localPort: '', remoteServer: '', remotePort: '' });
        setOpenTunnelDialog(false);
      } catch (error) {
        console.error('Failed to create tunnel:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const toggleTunnel = async (id: string, status: 'running' | 'stopped') => {
    setLoading(true);
    try {
      if (status === 'stopped') {
        await boreService.startTunnel(id);
      } else {
        await boreService.stopTunnel(id);
      }
      // 重新获取隧道列表
      const res = await boreService.getTunnels();
      setTunnels(res.data || []);
    } catch (error) {
      console.error('Failed to toggle tunnel:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProxy = () => {
    setOpenProxyDialog(true);
  };

  const handleSaveProxy = async () => {
    if (newProxy.name && newProxy.type && newProxy.server && newProxy.port) {
      setLoading(true);
      try {
        await clashService.createProxy({
          name: newProxy.name,
          type: newProxy.type,
          server: newProxy.server,
          port: newProxy.port,
          config: {},
        });
        // 重新获取代理列表
        const res = await clashService.getProxies();
        setProxies(res.data || []);
        setNewProxy({ name: '', type: 'Shadowsocks', server: '', port: '' });
        setOpenProxyDialog(false);
      } catch (error) {
        console.error('Failed to create proxy:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const toggleProxy = async (id: string, status: 'connected' | 'disconnected') => {
    setLoading(true);
    try {
      if (status === 'disconnected') {
        await clashService.connectProxy(id);
      } else {
        await clashService.disconnectProxy(id);
      }
      // 重新获取代理列表
      const res = await clashService.getProxies();
      setProxies(res.data || []);
    } catch (error) {
      console.error('Failed to toggle proxy:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSystemProxyToggle = async () => {
    setLoading(true);
    try {
      if (systemProxyEnabled) {
        await clashService.disableSystemProxy();
      } else {
        await clashService.enableSystemProxy();
      }
      setSystemProxyEnabled(!systemProxyEnabled);
    } catch (error) {
      console.error('Failed to toggle system proxy:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t('networkTools.title')}
        </Typography>
      </Box>

      <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 3 }}>
        <Tab label={t('networkTools.tunneling')} />
        <Tab label={t('networkTools.proxy')} />
      </Tabs>

      <TabPanel value={activeTab} index={0}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h6">{t('networkTools.tunnels')}</Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleAddTunnel}
          >
            {t('networkTools.addTunnel')}
          </Button>
        </Box>

        <Paper sx={{ p: 2 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <List>
              {tunnels.map((tunnel) => (
                <ListItem
                  key={tunnel.id}
                  secondaryAction={
                    <Box>
                      <IconButton
                        edge="end"
                        aria-label={tunnel.status === 'running' ? 'stop' : 'start'}
                        onClick={() => toggleTunnel(tunnel.id, tunnel.status)}
                      >
                        {tunnel.status === 'running' ? <Stop /> : <PlayArrow />}
                      </IconButton>
                      <IconButton edge="end" aria-label="settings">
                        <Settings />
                      </IconButton>
                      <IconButton edge="end" aria-label="delete">
                        <Delete />
                      </IconButton>
                    </Box>
                  }
                >
                  <ListItemIcon>
                    <NetworkCheck />
                  </ListItemIcon>
                  <ListItemText
                    primary={tunnel.name}
                    secondary={`Local: ${tunnel.localPort} → Remote: ${tunnel.remoteServer}:${tunnel.remotePort} (${tunnel.status})`}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h6">{t('networkTools.proxyManagement')}</Typography>
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={systemProxyEnabled}
                  onChange={handleSystemProxyToggle}
                />
              }
              label={t('networkTools.systemProxy')}
            />
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleAddProxy}
              sx={{ ml: 2 }}
            >
              {t('networkTools.addProxy')}
            </Button>
          </Box>
        </Box>

        <Paper sx={{ p: 2 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <List>
              {proxies.map((proxy) => (
                <ListItem
                  key={proxy.id}
                  secondaryAction={
                    <Box>
                      <IconButton
                        edge="end"
                        aria-label={proxy.status === 'connected' ? 'disconnect' : 'connect'}
                        onClick={() => toggleProxy(proxy.id, proxy.status)}
                      >
                        {proxy.status === 'connected' ? <Stop /> : <PlayArrow />}
                      </IconButton>
                      <IconButton edge="end" aria-label="settings">
                        <Settings />
                      </IconButton>
                      <IconButton edge="end" aria-label="delete">
                        <Delete />
                      </IconButton>
                    </Box>
                  }
                >
                  <ListItemIcon>
                    <VpnKey />
                  </ListItemIcon>
                  <ListItemText
                    primary={proxy.name}
                    secondary={`${proxy.type} | ${proxy.server}:${proxy.port} (${proxy.status})`}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
      </TabPanel>

      <Dialog open={openTunnelDialog} onClose={() => setOpenTunnelDialog(false)}>
        <DialogTitle>{t('networkTools.addTunnelTitle')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={t('networkTools.tunnelName')}
            fullWidth
            value={newTunnel.name}
            onChange={(e) => setNewTunnel({ ...newTunnel, name: e.target.value })}
          />
          <TextField
            margin="dense"
            label={t('networkTools.localPort')}
            fullWidth
            value={newTunnel.localPort}
            onChange={(e) => setNewTunnel({ ...newTunnel, localPort: e.target.value })}
          />
          <TextField
            margin="dense"
            label={t('networkTools.remoteServer')}
            fullWidth
            value={newTunnel.remoteServer}
            onChange={(e) => setNewTunnel({ ...newTunnel, remoteServer: e.target.value })}
          />
          <TextField
            margin="dense"
            label={t('networkTools.remotePort')}
            fullWidth
            value={newTunnel.remotePort}
            onChange={(e) => setNewTunnel({ ...newTunnel, remotePort: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenTunnelDialog(false)}>取消</Button>
          <Button onClick={handleSaveTunnel}>保存</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openProxyDialog} onClose={() => setOpenProxyDialog(false)}>
        <DialogTitle>{t('networkTools.addProxyTitle')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={t('networkTools.proxyName')}
            fullWidth
            value={newProxy.name}
            onChange={(e) => setNewProxy({ ...newProxy, name: e.target.value })}
          />
          <TextField
            margin="dense"
            label={t('networkTools.proxyType')}
            fullWidth
            value={newProxy.type}
            onChange={(e) => setNewProxy({ ...newProxy, type: e.target.value })}
          />
          <TextField
            margin="dense"
            label={t('networkTools.server')}
            fullWidth
            value={newProxy.server}
            onChange={(e) => setNewProxy({ ...newProxy, server: e.target.value })}
          />
          <TextField
            margin="dense"
            label={t('networkTools.port')}
            fullWidth
            value={newProxy.port}
            onChange={(e) => setNewProxy({ ...newProxy, port: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenProxyDialog(false)}>取消</Button>
          <Button onClick={handleSaveProxy}>保存</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default NetworkToolsPage;
