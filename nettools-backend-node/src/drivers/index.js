/**
 * 驱动索引 — 自动注册所有驱动到注册表
 */
const registry = require('./registry');
const { LocalStorageDriver } = require('./local');

// 注册本地驱动
registry.register('local', LocalStorageDriver, LocalStorageDriver.meta);

// 尝试注册各驱动（依赖未安装时跳过）
function tryRegister(modulePath, className, typeKey) {
  try {
    const mod = require(modulePath);
    const DriverClass = mod[className];
    if (DriverClass && DriverClass.meta) {
      registry.register(typeKey, DriverClass, DriverClass.meta);
      console.log(`[Drivers] Registered: ${DriverClass.meta.name || className} → ${typeKey}`);
    }
  } catch (err) {
    console.log(`[Drivers] Skipped ${className}: ${err.message.split('\n')[0]}`);
  }
}

// 标准协议驱动
tryRegister('./s3', 'S3Driver', 's3');
tryRegister('./webdav', 'WebDAVDriver', 'webdav');
tryRegister('./ftp', 'FTPDriver', 'ftp');
tryRegister('./sftp', 'SFTPDriver', 'sftp');
tryRegister('./smb', 'SMBDriver', 'smb');

// 云存储驱动
tryRegister('./aliyundrive', 'AliyunDriveDriver', 'aliyundrive');
tryRegister('./onedrive', 'OneDriveDriver', 'onedrive');
tryRegister('./googledrive', 'GoogleDriveDriver', 'googledrive');
tryRegister('./baidu_netdisk', 'BaiduNetDiskDriver', 'baidu');
tryRegister('./jianguoyun', 'JianguoyunDriver', 'jianguoyun');

console.log(`[Drivers] Total registered: ${registry.listTypes().length} driver types`);

module.exports = registry;
