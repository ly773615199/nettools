/**
 * 密钥生成工具
 * WireGuard 密钥对、FRP token、通用随机字符串
 */
const { execSync } = require('child_process');
const crypto = require('crypto');

class KeyGenerator {
  /**
   * 生成 WireGuard 密钥对
   * @returns {{ privateKey: string, publicKey: string }}
   */
  static wireguard() {
    try {
      const privateKey = execSync('wg genkey', { encoding: 'utf8' }).trim();
      const publicKey = execSync(`echo "${privateKey}" | wg pubkey`, { encoding: 'utf8' }).trim();
      return { privateKey, publicKey };
    } catch {
      // fallback: 用 crypto 生成 (非标准 WG 格式，但可用于占位)
      const priv = crypto.randomBytes(32);
      return {
        privateKey: priv.toString('base64'),
        publicKey: '<requires-wg-tools>',
      };
    }
  }

  /**
   * 生成随机 token/secret
   * @param {number} length - 字节长度，默认 32
   * @returns {string} hex string
   */
  static randomToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * 生成 FRP 认证 token
   * @returns {string}
   */
  static frpToken() {
    return KeyGenerator.randomToken(16);
  }

  /**
   * 生成 Bore secret
   * @returns {string}
   */
  static boreSecret() {
    return KeyGenerator.randomToken(16);
  }

  /**
   * 检测 wg 工具是否可用
   * @returns {boolean}
   */
  static hasWireguardTools() {
    try {
      execSync('which wg 2>/dev/null', { encoding: 'utf8' });
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = { KeyGenerator };
