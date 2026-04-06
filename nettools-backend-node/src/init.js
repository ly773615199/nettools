const bcrypt = require('bcrypt');
const os = require('os');
const { execSync } = require('child_process');
const { User, SystemSetting, PenetrationNode } = require('./models');

/**
 * 检测本机信息，用于自动注册本地穿透节点
 */
function detectLocalMachineInfo() {
  const platform = os.platform();
  const arch = os.arch();

  // 操作系统类型映射
  const osTypeMap = { linux: 'linux', darwin: 'macos', win32: 'windows' };
  let osType = osTypeMap[platform] || platform;

  // 检测 Linux 发行版
  if (platform === 'linux') {
    try {
      const osRelease = execSync('cat /etc/os-release 2>/dev/null || true', { encoding: 'utf8' });
      const idMatch = osRelease.match(/^ID=(.+)$/m);
      if (idMatch) osType = idMatch[1].replace(/"/g, '').trim();
      // 检测 NAS
      try { execSync('test -f /etc.defaults/VERSION', { encoding: 'utf8' }); osType = 'synology'; } catch {}
      try { execSync('getcfg System Platform -f /etc/platform.conf 2>/dev/null', { encoding: 'utf8' }); osType = 'qnap'; } catch {}
    } catch {}
  }

  // 检测已安装组件
  const installed = {};
  const checks = { wireguard: 'which wg', bore: 'which bore', frp: 'which frpc || which frps', cloudflare: 'which cloudflared', docker: 'which docker', autossh: 'which autossh' };
  for (const [key, cmd] of Object.entries(checks)) {
    try { execSync(`${cmd} 2>/dev/null`, { encoding: 'utf8' }); installed[key] = true; } catch { installed[key] = false; }
  }

  // 检测公网 IP（异步超时，不阻塞启动）
  let publicIp = null;
  try { publicIp = execSync('curl -s --connect-timeout 3 ifconfig.me 2>/dev/null || true', { encoding: 'utf8' }).trim() || null; } catch {}

  return {
    osType,
    arch: arch === 'arm64' ? 'aarch64' : arch,
    hasRoot: process.getuid ? process.getuid() === 0 : false,
    hasDocker: installed.docker || false,
    pkgManager: (() => { try { execSync('which apt 2>/dev/null'); return 'apt'; } catch {} try { execSync('which yum 2>/dev/null'); return 'yum'; } catch {} try { execSync('which brew 2>/dev/null'); return 'brew'; } catch {}; return 'none'; })(),
    installed,
    publicIp,
  };
}

// 初始化默认数据
const initDefaultData = async () => {
  try {
    // 检查是否已经有管理员用户
    const adminUser = await User.findOne({ where: { username: 'admin' } });
    let userId;
    if (!adminUser) {
      // 创建默认管理员用户
      const hashedPassword = await bcrypt.hash('password', 10);
      const newUser = await User.create({
        username: 'admin',
        password: hashedPassword,
        role: 'admin'
      });
      userId = newUser.id;
      console.log('Default admin user created: admin/password');
    } else {
      userId = adminUser.id;
    }

    // 检查是否已经有系统设置
    const settingCount = await SystemSetting.count();
    if (settingCount === 0) {
      // 创建默认系统设置
      await SystemSetting.bulkCreate([
        { key: 'language', value: 'zh', description: 'Default language' },
        { key: 'theme', value: 'light', description: 'Default theme' },
        { key: 'autoStart', value: 'false', description: 'Auto start on system boot' }
      ]);
      console.log('Default system settings created');
    }

    // 自动注册本地穿透节点
    const localNode = await PenetrationNode.findOne({ where: { nodeType: 'local', userId } });
    if (!localNode) {
      const info = detectLocalMachineInfo();
      await PenetrationNode.create({
        name: '本机',
        nodeType: 'local',
        host: 'localhost',
        sshPort: 22,
        sshUser: os.userInfo().username || 'root',
        sshAuth: 'none',
        osType: info.osType,
        arch: info.arch,
        hasRoot: info.hasRoot,
        hasDocker: info.hasDocker,
        pkgManager: info.pkgManager,
        installed: info.installed,
        publicIp: info.publicIp,
        status: 'reachable',
        lastSeenAt: new Date(),
        userId,
      });
      console.log(`Local penetration node auto-registered (os=${info.osType}, arch=${info.arch})`);
    }

    console.log('Default data initialization completed');
  } catch (error) {
    console.error('Error initializing default data:', error);
  }
};

initDefaultData();
