import { configService } from '../config/configService';

// 语言资源
const messages = {
  zh: {
    // 登录页面
    login: {
      title: '登录 NetTools',
      username: '用户名',
      password: '密码',
      login: '登录',
      defaultCredentials: '默认凭据: admin / password',
      error: '登录失败，请检查用户名和密码',
      rememberMe: '记住我',
      captcha: '验证码',
      forgotPassword: '忘记密码？',
      register: '注册',
    },
    // 首页
    home: {
      welcome: '欢迎使用 NetTools',
      description: '一个集成了文件管理、隧道和代理服务的综合网络工具。',
      fileManagement: '文件管理',
      fileManagementDescription: '轻松管理不同存储服务中的文件。高效地上传、下载和组织文件。',
      goToFileManagement: '前往文件管理',
      networkTools: '网络工具',
      networkToolsDescription: '创建和管理用于端口转发的 TCP 隧道，以及用于网络优化的代理服务。',
      goToNetworkTools: '前往网络工具',
      settings: '设置',
      settingsDescription: '配置系统设置，管理存储服务，自定义您的 NetTools 体验。',
      goToSettings: '前往设置',
      about: '关于 NetTools',
      aboutDescription: 'NetTools 是一个强大的网络工具，它将文件管理、隧道和代理服务整合到一个应用程序中。它提供了一个统一的界面，用于管理文件、创建 TCP 隧道和优化网络连接。',
      version: '版本: 1.0.0',
    },
    // 文件管理页面
    fileManagement: {
      title: '文件管理',
      storageServices: '存储服务',
      fileExplorer: '文件浏览器',
      addStorage: '添加存储',
      files: '文件',
      upload: '上传',
      createFolder: '创建文件夹',
      more: '更多',
      addStorageService: '添加存储服务',
      storageName: '存储名称',
      storageType: '存储类型',
      path: '路径',
      cancel: '取消',
      save: '保存',
    },
    // 网络工具页面
    networkTools: {
      title: '网络工具',
      tunneling: '隧道 (Bore)',
      proxy: '代理 (Clash)',
      tunnels: '隧道',
      addTunnel: '添加隧道',
      proxyManagement: '代理管理',
      systemProxy: '系统代理',
      addProxy: '添加代理',
      addTunnelTitle: '添加隧道',
      tunnelName: '隧道名称',
      localPort: '本地端口',
      remoteServer: '远程服务器',
      remotePort: '远程端口 (可选)',
      addProxyTitle: '添加代理',
      proxyName: '代理名称',
      proxyType: '代理类型',
      server: '服务器',
      port: '端口',
    },
    // 设置页面
    settings: {
      title: '设置',
      systemSettings: '系统设置',
      language: '语言',
      darkMode: '深色模式',
      autoStart: '自动启动',
      saveSettings: '保存设置',
      settingsSaved: '设置保存成功',
      settingsFailed: '设置保存失败',
    },
    // 导航栏
    navigation: {
      home: '首页',
      fileManagement: '文件管理',
      networkTools: '网络工具',
      settings: '设置',
      logout: '退出登录',
    },
  },
  en: {
    // 登录页面
    login: {
      title: 'Sign in to NetTools',
      username: 'Username',
      password: 'Password',
      login: 'Sign In',
      defaultCredentials: 'Default credentials: admin / password',
      error: 'Login failed, please check your username and password',
      rememberMe: 'Remember me',
      captcha: 'Captcha',
      forgotPassword: 'Forgot password?',
      register: 'Register',
    },
    // 首页
    home: {
      welcome: 'Welcome to NetTools',
      description: 'A comprehensive network tool that integrates file management, tunneling, and proxy services.',
      fileManagement: 'File Management',
      fileManagementDescription: 'Manage your files across different storage services with ease. Upload, download, and organize your files efficiently.',
      goToFileManagement: 'Go to File Management',
      networkTools: 'Network Tools',
      networkToolsDescription: 'Create and manage TCP tunnels for port forwarding and proxy services for network optimization.',
      goToNetworkTools: 'Go to Network Tools',
      settings: 'Settings',
      settingsDescription: 'Configure system settings, manage storage services, and customize your NetTools experience.',
      goToSettings: 'Go to Settings',
      about: 'About NetTools',
      aboutDescription: 'NetTools is a powerful network tool that combines file management, tunneling, and proxy services into a single application. It provides a unified interface for managing your files, creating TCP tunnels, and optimizing your network connection.',
      version: 'Version: 1.0.0',
    },
    // 文件管理页面
    fileManagement: {
      title: 'File Management',
      storageServices: 'Storage Services',
      fileExplorer: 'File Explorer',
      addStorage: 'Add Storage',
      files: 'Files',
      upload: 'Upload',
      createFolder: 'Create Folder',
      more: 'More',
      addStorageService: 'Add Storage Service',
      storageName: 'Storage Name',
      storageType: 'Storage Type',
      path: 'Path',
      cancel: 'Cancel',
      save: 'Save',
    },
    // 网络工具页面
    networkTools: {
      title: 'Network Tools',
      tunneling: 'Tunneling (Bore)',
      proxy: 'Proxy (Clash)',
      tunnels: 'Tunnels',
      addTunnel: 'Add Tunnel',
      proxyManagement: 'Proxy Management',
      systemProxy: 'System Proxy',
      addProxy: 'Add Proxy',
      addTunnelTitle: 'Add Tunnel',
      tunnelName: 'Tunnel Name',
      localPort: 'Local Port',
      remoteServer: 'Remote Server',
      remotePort: 'Remote Port (Optional)',
      addProxyTitle: 'Add Proxy',
      proxyName: 'Proxy Name',
      proxyType: 'Proxy Type',
      server: 'Server',
      port: 'Port',
    },
    // 设置页面
    settings: {
      title: 'Settings',
      systemSettings: 'System Settings',
      language: 'Language',
      darkMode: 'Dark Mode',
      autoStart: 'Auto Start',
      saveSettings: 'Save Settings',
      settingsSaved: 'Settings saved successfully',
      settingsFailed: 'Failed to save settings',
    },
    // 导航栏
    navigation: {
      home: 'Home',
      fileManagement: 'File Management',
      networkTools: 'Network Tools',
      settings: 'Settings',
      logout: 'Logout',
    },
  },
};

// 获取当前语言
const getCurrentLanguage = (): 'zh' | 'en' => {
  const systemSettings = configService.getSystemSettings();
  return (systemSettings.language === 'zh' || systemSettings.language === 'en') ? systemSettings.language : 'zh';
};

// 国际化函数
export const t = (key: string): string => {
  const language = getCurrentLanguage();
  const keys = key.split('.');
  let value: any = messages[language];
  
  for (const k of keys) {
    if (value && typeof value === 'object') {
      value = value[k];
    } else {
      return key; // 如果找不到对应的文本，返回原始键
    }
  }
  
  return typeof value === 'string' ? value : key;
};

// 切换语言
export const switchLanguage = (language: 'zh' | 'en') => {
  configService.switchLanguage(language);
};
