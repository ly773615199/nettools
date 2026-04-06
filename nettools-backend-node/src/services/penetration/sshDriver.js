/**
 * SSH 反向隧道驱动
 * 利用 ssh -R 实现端口转发，搭配 autossh 断线重连
 */
const { spawn, execSync } = require('child_process');
const { BasePenetrationDriver } = require('./baseDriver');

class SshDriver extends BasePenetrationDriver {
  constructor() {
    super('ssh');
  }

  async detect() {
    try {
      execSync('which ssh 2>/dev/null', { encoding: 'utf8' });
      const hasAutossh = !!execSync('which autossh 2>/dev/null || true', { encoding: 'utf8' }).trim();
      return { available: true, hasAutossh };
    } catch {
      return { available: false, reason: 'ssh not found' };
    }
  }

  generateClientConfig(instance) {
    const config = instance.config || {};
    const mappings = instance.mappings || [];
    const serverHost = config.serverHost || '<SERVER_IP>';
    const serverUser = config.serverUser || 'root';
    const serverPort = config.serverSshPort || 22;
    const keyPath = config.sshKeyPath || '';

    let script = `#!/bin/bash\n# NetTools SSH Reverse Tunnel\n# Server: ${serverUser}@${serverHost}:${serverPort}\n\n`;

    for (const m of mappings) {
      const remoteBind = m.remoteBind || '0.0.0.0';
      const remotePort = m.remotePort || m.localPort;
      const localPort = m.localPort;

      let sshCmd = `ssh -N -R ${remoteBind}:${remotePort}:127.0.0.1:${localPort}`;
      if (keyPath) sshCmd += ` -i ${keyPath}`;
      sshCmd += ` -p ${serverPort} -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes`;
      sshCmd += ` ${serverUser}@${serverHost}`;

      // 使用 autossh 如果可用
      script += `# Mapping: localhost:${localPort} -> ${serverHost}:${remotePort}\n`;
      script += `AUTOSSH_GATETIME=0 autossh -M 0 -f ${sshCmd.replace('ssh ', '')}\n\n`;
    }

    return {
      files: [],
      content: script,
      filename: `nettools-ssh-tunnel-${instance.name || 'default'}.sh`,
    };
  }

  start(instance) {
    const config = instance.config || {};
    const mappings = instance.mappings || [];
    if (!mappings.length) throw new Error('At least one mapping is required');

    const serverHost = config.serverHost;
    const serverUser = config.serverUser || 'root';
    const serverPort = config.serverSshPort || 22;
    const keyPath = config.sshKeyPath || '';

    const m = mappings[0];
    const remoteBind = m.remoteBind || '0.0.0.0';
    const remotePort = m.remotePort || m.localPort;

    const args = [
      '-N',
      '-R', `${remoteBind}:${remotePort}:127.0.0.1:${m.localPort}`,
      '-p', String(serverPort),
      '-o', 'ServerAliveInterval=30',
      '-o', 'ServerAliveCountMax=3',
      '-o', 'ExitOnForwardFailure=yes',
      '-o', 'StrictHostKeyChecking=accept-new',
    ];
    if (keyPath) args.push('-i', keyPath);
    args.push(`${serverUser}@${serverHost}`);

    // 优先用 autossh
    let bin = 'autossh';
    try { execSync('which autossh 2>/dev/null'); } catch { bin = 'ssh'; }

    const env = bin === 'autossh' ? { ...process.env, AUTOSSH_GATETIME: '0' } : process.env;
    const proc = spawn(bin === 'autossh' ? 'autossh' : 'ssh',
      bin === 'autossh' ? ['-M', '0', ...args] : args,
      { stdio: ['ignore', 'pipe', 'pipe'], env }
    );

    proc.stdout.on('data', d => console.log(`[ssh:${instance.id}] ${d.toString().trim()}`));
    proc.stderr.on('data', d => console.error(`[ssh:${instance.id}] ${d.toString().trim()}`));

    return proc;
  }

  stop(context) {
    if (context && context.process) {
      try { context.process.kill('SIGTERM'); } catch {}
    }
  }

  getStatus(context) {
    if (!context || !context.process) return { running: false };
    return { running: context.process.exitCode === null };
  }

  exportClientConfig(instance) {
    const result = this.generateClientConfig(instance);
    return {
      content: result.content,
      filename: result.filename,
    };
  }

  generateDeployScript() {
    // SSH 隧道不需要在服务端部署任何东西，只需确保 SSH 可达
    return {
      files: [],
      commands: [
        'echo "SSH reverse tunnel requires no server-side deployment. Just ensure SSH is accessible."',
      ],
    };
  }
}

module.exports = { SshDriver };
