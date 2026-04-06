import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Tabs, Tab, Paper, List, ListItem, ListItemText, ListItemIcon, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, CircularProgress, Container } from '@mui/material';
import { Add, Folder, Cloud, PlayArrow, Stop, Settings, Delete, Upload, Download, CreateNewFolder, MoreVert } from '@mui/icons-material';
import { openlistService } from '../core/storage/openlistService';
import type { StorageService } from '../core/types';
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
      id={`file-management-tabpanel-${index}`}
      aria-labelledby={`file-management-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const FileManagementPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [storages, setStorages] = useState<StorageService[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [openStorageDialog, setOpenStorageDialog] = useState(false);
  const [newStorage, setNewStorage] = useState({ name: '', type: 'local', path: '/' });
  const [loading, setLoading] = useState(false);
  const [selectedStorage, setSelectedStorage] = useState<string>('');

  // 从API获取存储服务列表
  useEffect(() => {
    const fetchStorages = async () => {
      setLoading(true);
      try {
        const res = await openlistService.getStorageServices();
        setStorages(res.data);
        if (res.data.length > 0) {
          setSelectedStorage(res.data[0].id);
          fetchFiles(res.data[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch storages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStorages();
  }, []);

  // 从API获取文件列表
  const fetchFiles = async (storageId: string) => {
    setLoading(true);
    try {
      const res = await openlistService.listFiles(storageId, '/');
      setFiles(res.data);
    } catch (error) {
      console.error('Failed to fetch files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleAddStorage = () => {
    setOpenStorageDialog(true);
  };

  const handleSaveStorage = async () => {
    if (newStorage.name) {
      setLoading(true);
      try {
        await openlistService.addStorageService({
          name: newStorage.name,
          type: newStorage.type,
          config: { path: newStorage.path },
        });
        // 重新获取存储服务列表
        const res = await openlistService.getStorageServices();
        setStorages(res.data);
        setNewStorage({ name: '', type: 'local', path: '/' });
        setOpenStorageDialog(false);
      } catch (error) {
        console.error('Failed to create storage:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const toggleStorage = async (id: string, status: 'online' | 'offline') => {
    setLoading(true);
    try {
      if (status === 'offline') {
        await openlistService.enableStorageService(id);
      } else {
        await openlistService.disableStorageService(id);
      }
      // 重新获取存储服务列表
      const res = await openlistService.getStorageServices();
      setStorages(res.data);
    } catch (error) {
      console.error('Failed to toggle storage:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStorageSelect = (id: string) => {
    setSelectedStorage(id);
    fetchFiles(id);
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t('fileManagement.title')}
        </Typography>
      </Box>

      <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 3 }}>
        <Tab label={t('fileManagement.storageServices')} />
        <Tab label={t('fileManagement.fileExplorer')} />
      </Tabs>

      <TabPanel value={activeTab} index={0}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h6">{t('fileManagement.storageServices')}</Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleAddStorage}
          >
            {t('fileManagement.addStorage')}
          </Button>
        </Box>

        <Paper sx={{ p: 2 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <List>
              {storages.map((storage) => (
                <ListItem
                  key={storage.id}
                  secondaryAction={
                    <Box>
                      <IconButton
                        edge="end"
                        aria-label={storage.status === 'online' ? 'disable' : 'enable'}
                        onClick={() => toggleStorage(storage.id, storage.status)}
                      >
                        {storage.status === 'online' ? <Stop /> : <PlayArrow />}
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
                    {storage.type === 'local' ? <Folder /> : <Cloud />}
                  </ListItemIcon>
                  <ListItemText
                    primary={storage.name}
                    secondary={`Type: ${storage.type} | Status: ${storage.status}`}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            {t('fileManagement.fileExplorer')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ flex: '1 1 300px', minWidth: '300px' }}>
              <Paper sx={{ p: 2, height: '400px', overflow: 'auto' }}>
                <Typography variant="subtitle1" gutterBottom>
                  {t('fileManagement.storageServices')}
                </Typography>
                <List>
                  {storages.map((storage) => (
                    <ListItem
                      key={storage.id}
                      sx={{ cursor: 'pointer', backgroundColor: selectedStorage === storage.id ? 'action.selected' : 'transparent' }}
                      onClick={() => handleStorageSelect(storage.id)}
                    >
                      <ListItemIcon>
                        {storage.type === 'local' ? <Folder /> : <Cloud />}
                      </ListItemIcon>
                      <ListItemText
                        primary={storage.name}
                        secondary={`Status: ${storage.status}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Box>
            <Box sx={{ flex: '1 1 500px', minWidth: '300px' }}>
              <Paper sx={{ p: 2, height: '400px', overflow: 'auto' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="subtitle1">{t('fileManagement.files')}</Typography>
                  <Box>
                    <IconButton aria-label={t('fileManagement.upload')}>
                      <Upload />
                    </IconButton>
                    <IconButton aria-label={t('fileManagement.createFolder')}>
                      <CreateNewFolder />
                    </IconButton>
                    <IconButton aria-label={t('fileManagement.more')}>
                      <MoreVert />
                    </IconButton>
                  </Box>
                </Box>
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <List>
                    {files.map((file, index) => (
                      <ListItem
                        key={index}
                        secondaryAction={
                          <IconButton edge="end" aria-label="download">
                            <Download />
                          </IconButton>
                        }
                      >
                        <ListItemIcon>
                          {file.type === 'folder' ? <Folder /> : <File />}
                        </ListItemIcon>
                        <ListItemText
                          primary={file.name}
                          secondary={`Size: ${file.size} bytes | Modified: ${file.modified}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Paper>
            </Box>
          </Box>
        </Box>
      </TabPanel>

      <Dialog open={openStorageDialog} onClose={() => setOpenStorageDialog(false)}>
        <DialogTitle>{t('fileManagement.addStorageService')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={t('fileManagement.storageName')}
            fullWidth
            value={newStorage.name}
            onChange={(e) => setNewStorage({ ...newStorage, name: e.target.value })}
          />
          <TextField
            margin="dense"
            label={t('fileManagement.storageType')}
            fullWidth
            value={newStorage.type}
            onChange={(e) => setNewStorage({ ...newStorage, type: e.target.value })}
          />
          <TextField
            margin="dense"
            label={t('fileManagement.path')}
            fullWidth
            value={newStorage.path}
            onChange={(e) => setNewStorage({ ...newStorage, path: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenStorageDialog(false)}>{t('fileManagement.cancel')}</Button>
          <Button onClick={handleSaveStorage}>{t('fileManagement.save')}</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

// 临时的File图标组件
const File: React.FC = (props) => {
  return <Box sx={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }} {...props}>
    📄
  </Box>;
};

export default FileManagementPage;
