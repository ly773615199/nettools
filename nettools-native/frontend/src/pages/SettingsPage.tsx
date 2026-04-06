import React, { useState, useEffect } from 'react';
import { Container, Typography, Card, CardContent, TextField, Button, Switch, FormControlLabel, Box, Alert, Snackbar } from '@mui/material';
import { configService } from '../core/config/configService';
import type { AppConfig } from '../core/types';
import { t } from '../core/i18n/i18n';

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AppConfig>({
    storage: [
      {
        id: '1',
        name: 'Local Storage',
        type: 'local',
        status: 'offline',
        config: {
          path: '/',
        },
      },
    ],
    tunnels: [
      {
        id: '1',
        name: 'Local Web Server',
        localPort: '8080',
        remoteServer: 'bore.pub',
        remotePort: '12345',
        status: 'stopped',
      },
    ],
    proxies: [
      {
        id: '1',
        name: 'US Server',
        type: 'Shadowsocks',
        server: 'us.example.com',
        port: '8388',
        status: 'disconnected',
        config: {},
      },
    ],
    system: {
      language: 'en',
      theme: 'light',
      autoStart: false,
    },
  });

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });

  useEffect(() => {
    // Load settings from config service
    const loadSettings = async () => {
      const savedSettings = await configService.getConfig();
      if (savedSettings) {
        setSettings(savedSettings);
      }
    };

    loadSettings();
  }, []);

  const handleChange = (_section: string, field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      system: {
        ...prev.system,
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    try {
      await configService.setConfig(settings);
      setSnackbar({
        open: true,
        message: 'Settings saved successfully',
        severity: 'success',
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to save settings',
        severity: 'error',
      });
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  return (
    <Container maxWidth="md">
      <Typography variant="h4" component="h1" gutterBottom>
        {t('settings.title')}
      </Typography>

      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" component="h2" gutterBottom>
            {t('settings.systemSettings')}
          </Typography>
          <TextField
            label={t('settings.language')}
            select
            value={settings.system.language}
            onChange={(e) => handleChange('system', 'language', e.target.value)}
            fullWidth
            margin="normal"
            SelectProps={{
              native: true,
            }}
          >
            <option value="zh">中文</option>
            <option value="en">English</option>
          </TextField>
          <FormControlLabel
            control={
              <Switch
                checked={settings.system.theme === 'dark'}
                onChange={(e) => handleChange('system', 'theme', e.target.checked ? 'dark' : 'light')}
              />
            }
            label={t('settings.darkMode')}
          />
          <FormControlLabel
            control={
              <Switch
                checked={settings.system.autoStart}
                onChange={(e) => handleChange('system', 'autoStart', e.target.checked)}
              />
            }
            label={t('settings.autoStart')}
          />
        </CardContent>
      </Card>

      <Box sx={{ mt: 4, textAlign: 'right' }}>
        <Button variant="contained" color="primary" onClick={handleSave}>
          {t('settings.saveSettings')}
        </Button>
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message === 'Settings saved successfully' ? t('settings.settingsSaved') : t('settings.settingsFailed')}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default SettingsPage;