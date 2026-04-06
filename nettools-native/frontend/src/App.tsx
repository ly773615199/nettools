import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Drawer, AppBar, Toolbar, List, ListItem, ListItemIcon, ListItemText, Typography, Box, Divider } from '@mui/material';
import {
  Home, Folder, NetworkCheck, Settings, Logout,
  Download, Shield, Rule, Storage, Router as RouterIcon
} from '@mui/icons-material';
import HomePage from './pages/HomePage';
import FileManagementPage from './pages/FileManagementPage';
import NetworkToolsPage from './pages/NetworkToolsPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import StorageManagePage from './pages/StorageManagePage';
import DownloadPage from './pages/DownloadPage';
import ClashRulesPage from './pages/ClashRulesPage';
import SystemProxyPage from './pages/SystemProxyPage';
import PenetrationPage from './pages/PenetrationPage';
import { configService } from './core/config/configService';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
  typography: {
    fontFamily: 'Roboto, sans-serif',
  },
});

const drawerWidth = 240;

// 受保护的路由组件
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = configService.getAuthToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

// 退出登录处理函数
const handleLogout = async () => {
  await configService.logout();
  window.location.href = '/login';
};

const navItems = [
  { path: '/', label: 'Home', icon: <Home /> },
  { path: '/files', label: 'Files', icon: <Folder /> },
  { path: '/storage', label: 'Storage', icon: <Storage /> },
  { path: '/downloads', label: 'Downloads', icon: <Download /> },
  { divider: true },
  { path: '/network', label: 'Network', icon: <NetworkCheck /> },
  { path: '/clash', label: 'Clash Rules', icon: <Rule /> },
  { path: '/proxy', label: 'System Proxy', icon: <Shield /> },
  { path: '/penetration', label: 'Penetration', icon: <RouterIcon /> },
  { divider: true },
  { path: '/settings', label: 'Settings', icon: <Settings /> },
];

// 主应用组件
function MainApp() {
  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" noWrap component="div">
            NetTools
          </Typography>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{ width: drawerWidth, flexShrink: 0, [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' } }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List>
            {navItems.map((item, i) => {
              if ('divider' in item) {
                return <Divider key={`d-${i}`} sx={{ my: 1 }} />;
              }
              return (
                <ListItem key={item.path} component="a" href={item.path} sx={{ cursor: 'pointer' }}>
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItem>
              );
            })}
            <Divider sx={{ my: 1 }} />
            <ListItem sx={{ cursor: 'pointer' }} onClick={handleLogout}>
              <ListItemIcon><Logout /></ListItemIcon>
              <ListItemText primary="Logout" />
            </ListItem>
          </List>
        </Box>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3, ml: drawerWidth }}>
        <Toolbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/files" element={<FileManagementPage />} />
          <Route path="/storage" element={<StorageManagePage />} />
          <Route path="/downloads" element={<DownloadPage />} />
          <Route path="/network" element={<NetworkToolsPage />} />
          <Route path="/clash" element={<ClashRulesPage />} />
          <Route path="/proxy" element={<SystemProxyPage />} />
          <Route path="/penetration" element={<PenetrationPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Box>
    </Box>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={<ProtectedRoute><MainApp /></ProtectedRoute>} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
