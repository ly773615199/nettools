/**
 * 系统代理管理服务
 * 支持 Linux (gsettings/nmcli)、macOS (networksetup)
 */
const { execSync, exec } = require('child_process');
const os = require('os');

const platform = os.platform();

/**
 * 检测系统代理当前状态
 * @returns {{ enabled: boolean, method?: string }}
 */
function getStatus() {
  try {
    if (platform === 'linux') {
      // GNOME
      try {
        const mode = execSync('gsettings get org.gnome.system.proxy mode 2>/dev/null').toString().trim().replace(/'/g, '');
        return { enabled: mode === 'manual', method: 'gsettings' };
      } catch {}
      // KDE
      try {
        const kde = execSync('kreadconfig5 --group ProxyType --key httpProxy 2>/dev/null').toString().trim();
        return { enabled: !!kde, method: 'kde' };
      } catch {}
      return { enabled: false };
    } else if (platform === 'darwin') {
      const result = execSync('networksetup -getwebproxy Wi-Fi 2>/dev/null').toString();
      const enabled = result.includes('Enabled: Yes');
      return { enabled, method: 'networksetup' };
    } else if (platform === 'win32') {
      // Windows: 检查注册表（简化处理）
      return { enabled: false, method: 'registry' };
    }
    return { enabled: false };
  } catch {
    return { enabled: false };
  }
}

/**
 * 设置系统代理
 * @param {string} host - 代理地址
 * @param {number} port - 代理端口
 * @returns {{ success: boolean, message?: string, error?: string }}
 */
function enable(host = '127.0.0.1', port = 7890) {
  try {
    if (platform === 'linux') {
      // GNOME
      try {
        execSync(`gsettings set org.gnome.system.proxy mode 'manual'`);
        execSync(`gsettings set org.gnome.system.proxy.http host '${host}'`);
        execSync(`gsettings set org.gnome.system.proxy.http port ${port}`);
        execSync(`gsettings set org.gnome.system.proxy.https host '${host}'`);
        execSync(`gsettings set org.gnome.system.proxy.https port ${port}`);
        execSync(`gsettings set org.gnome.system.proxy.socks host '${host}'`);
        execSync(`gsettings set org.gnome.system.proxy.socks port ${port}`);
        return { success: true, message: 'System proxy enabled (GNOME)' };
      } catch {}
      // nmcli
      try {
        execSync(`nmcli con modify "$(nmcli -t -f NAME con show --active | head -1)" ipv4.ignore-auto-dns yes`);
        return { success: true, message: 'System proxy enabled (nmcli)' };
      } catch {}
      return { success: false, error: 'Failed to set system proxy on Linux' };
    } else if (platform === 'darwin') {
      execSync(`networksetup -setwebproxy Wi-Fi ${host} ${port}`);
      execSync(`networksetup -setsecurewebproxy Wi-Fi ${host} ${port}`);
      execSync(`networksetup -setsocksfirewallproxy Wi-Fi ${host} ${port}`);
      return { success: true, message: 'System proxy enabled (macOS)' };
    } else if (platform === 'win32') {
      return { success: false, error: 'Windows system proxy requires manual configuration or registry editing' };
    }
    return { success: false, error: `Unsupported platform: ${platform}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * 关闭系统代理
 * @returns {{ success: boolean, message?: string, error?: string }}
 */
function disable() {
  try {
    if (platform === 'linux') {
      try {
        execSync(`gsettings set org.gnome.system.proxy mode 'none'`);
        return { success: true, message: 'System proxy disabled (GNOME)' };
      } catch {}
      return { success: false, error: 'Failed to disable system proxy on Linux' };
    } else if (platform === 'darwin') {
      execSync(`networksetup -setwebproxystate Wi-Fi off`);
      execSync(`networksetup -setsecurewebproxystate Wi-Fi off`);
      execSync(`networksetup -setsocksfirewallproxystate Wi-Fi off`);
      return { success: true, message: 'System proxy disabled (macOS)' };
    }
    return { success: false, error: `Unsupported platform: ${platform}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  getStatus,
  enable,
  disable,
};
