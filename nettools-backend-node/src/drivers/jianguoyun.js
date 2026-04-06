/**
 * 坚果云驱动 — 基于 WebDAV 协议
 * 继承 WebDAVDriver，仅修改初始化和元信息
 */
const { WebDAVDriver } = require('./webdav');

class JianguoyunDriver extends WebDAVDriver {
  constructor(config = {}) {
    // 坚果云固定 URL
    const merged = {
      url: 'https://dav.jianguoyun.com/dav/',
      ...config,
    };
    super(merged);
    this.name = 'Jianguoyun (坚果云)';
    this.type = 'jianguoyun';
  }

  async init() {
    if (!this.config.username || !this.config.password) {
      throw new Error('Jianguoyun config error: username and password (app token) are required');
    }
    await super.init();
  }
}

JianguoyunDriver.meta = {
  name: 'Jianguoyun (坚果云)',
  description: '坚果云 WebDAV 协议',
  configFields: [
    { name: 'username', label: 'Username', type: 'text', required: true, help: '坚果云账号' },
    { name: 'password', label: 'App Token', type: 'password', required: true, help: '坚果云应用密码（非登录密码）' },
  ],
};

module.exports = { JianguoyunDriver };
