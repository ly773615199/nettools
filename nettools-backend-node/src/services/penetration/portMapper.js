/**
 * 端口映射管理器
 * 管理 iptables/nftables DNAT 规则，用于 WireGuard 等穿透场景的端口转发
 */
const { execSync, exec } = require('child_process');

class PortMapper {
  constructor() {
    // 跟踪已添加的规则，便于清理
    this.activeRules = new Map(); // instanceId -> [{ chain, rule }]
  }

  /**
   * 检测可用的防火墙工具
   * @returns {{ tool: 'iptables' | 'nftables' | 'none', available: boolean }}
   */
  detectFirewallTool() {
    try {
      execSync('which iptables 2>/dev/null', { encoding: 'utf8' });
      return { tool: 'iptables', available: true };
    } catch {}

    try {
      execSync('which nft 2>/dev/null', { encoding: 'utf8' });
      return { tool: 'nftables', available: true };
    } catch {}

    return { tool: 'none', available: false };
  }

  /**
   * 添加 DNAT 端口映射规则
   * @param {Object} options
   * @param {string} options.protocol - tcp/udp
   * @param {number} options.remotePort - 公网服务器监听端口
   * @param {string} options.targetIp - 目标 IP (隧道内网 IP)
   * @param {number} options.targetPort - 目标端口
   * @param {string} options.subnet - VPN 子网 (用于 MASQUERADE)
   * @param {number} options.instanceId - 实例 ID (用于跟踪)
   * @returns {{ success: boolean, commands: string[], error?: string }}
   */
  addDnatRule(options) {
    const { protocol, remotePort, targetIp, targetPort, subnet, instanceId } = options;
    const tool = this.detectFirewallTool();

    if (!tool.available) {
      return { success: false, commands: [], error: 'No firewall tool (iptables/nft) available' };
    }

    const commands = [];

    if (tool.tool === 'iptables') {
      // DNAT 规则
      const dnatRule = `iptables -t nat -A PREROUTING -p ${protocol} --dport ${remotePort} -j DNAT --to-destination ${targetIp}:${targetPort}`;
      commands.push(dnatRule);

      // MASQUERADE 规则 (如果指定子网)
      if (subnet) {
        const masqRule = `iptables -A POSTROUTING -s ${subnet} -j MASQUERADE`;
        commands.push(masqRule);
      }

      // 确保 IP 转发开启
      commands.push('sysctl -w net.ipv4.ip_forward=1');
    } else if (tool.tool === 'nftables') {
      // nftables 规则
      commands.push(`nft add rule nat prerouting ${protocol} dport ${remotePort} dnat ${targetIp}:${targetPort}`);
      if (subnet) {
        commands.push(`nft add rule nat postrouting ip saddr ${subnet} masquerade`);
      }
      commands.push('sysctl -w net.ipv4.ip_forward=1');
    }

    // 执行命令
    try {
      for (const cmd of commands) {
        execSync(cmd, { encoding: 'utf8', timeout: 10000 });
      }

      // 记录规则
      if (!this.activeRules.has(instanceId)) {
        this.activeRules.set(instanceId, []);
      }
      this.activeRules.get(instanceId).push({
        tool: tool.tool,
        protocol,
        remotePort,
        targetIp,
        targetPort,
        subnet,
        commands,
      });

      return { success: true, commands };
    } catch (err) {
      return { success: false, commands, error: err.message };
    }
  }

  /**
   * 移除 DNAT 端口映射规则
   * @param {number} instanceId - 实例 ID
   * @returns {{ success: boolean, removed: number }}
   */
  removeDnatRules(instanceId) {
    const rules = this.activeRules.get(instanceId);
    if (!rules || rules.length === 0) {
      return { success: true, removed: 0 };
    }

    let removed = 0;
    for (const rule of rules) {
      try {
        if (rule.tool === 'iptables') {
          // 将 -A 替换为 -D 来删除规则
          const dnatDelete = rule.commands[0].replace('-A PREROUTING', '-D PREROUTING');
          execSync(dnatDelete, { encoding: 'utf8', timeout: 10000 });

          if (rule.subnet && rule.commands.length > 1) {
            const masqDelete = rule.commands[1].replace('-A POSTROUTING', '-D POSTROUTING');
            execSync(masqDelete, { encoding: 'utf8', timeout: 10000 });
          }
        } else if (rule.tool === 'nftables') {
          // nftables 需要列出规则并删除 (简化处理)
          // 实际生产中应更精确处理
          execSync(`nft delete rule nat prerouting handle $(nft -a list table nat 2>/dev/null | grep "dport ${rule.remotePort}" | awk '{print $NF}') 2>/dev/null || true`, { encoding: 'utf8', timeout: 10000 });
        }
        removed++;
      } catch (err) {
        console.error(`[PortMapper] Failed to remove rule: ${err.message}`);
      }
    }

    this.activeRules.delete(instanceId);
    return { success: true, removed };
  }

  /**
   * 生成 iptables 规则字符串 (不执行)
   * @param {Object} options
   * @returns {{ postUp: string[], postDown: string[] }}
   */
  generateIptablesRules(options) {
    const { protocol, remotePort, targetIp, targetPort, subnet } = options;

    const postUp = [
      `iptables -t nat -A PREROUTING -p ${protocol} --dport ${remotePort} -j DNAT --to-destination ${targetIp}:${targetPort}`,
    ];
    const postDown = [
      `iptables -t nat -D PREROUTING -p ${protocol} --dport ${remotePort} -j DNAT --to-destination ${targetIp}:${targetPort}`,
    ];

    if (subnet) {
      postUp.push(`iptables -A POSTROUTING -s ${subnet} -j MASQUERADE`);
      postDown.push(`iptables -D POSTROUTING -s ${subnet} -j MASQUERADE`);
    }

    return { postUp, postDown };
  }

  /**
   * 从 mappings 数组批量生成 iptables 规则
   * @param {Array} mappings - [{ localPort, remotePort, protocol }]
   * @param {string} targetIp - 目标 IP
   * @param {string} subnet - VPN 子网
   * @returns {{ postUp: string[], postDown: string[] }}
   */
  generateRulesFromMappings(mappings, targetIp, subnet) {
    const postUp = ['sysctl -w net.ipv4.ip_forward=1'];
    const postDown = [];

    for (const m of mappings) {
      const proto = m.protocol || 'tcp';
      const rules = this.generateIptablesRules({
        protocol: proto,
        remotePort: m.remotePort,
        targetIp,
        targetPort: m.localPort,
        subnet,
      });
      postUp.push(...rules.postUp);
      postDown.push(...rules.postDown);
    }

    return { postUp, postDown };
  }

  /**
   * 检查端口是否已被占用
   * @param {number} port
   * @param {string} protocol - tcp/udp
   * @returns {boolean}
   */
  isPortInUse(port, protocol = 'tcp') {
    try {
      const output = execSync(`ss -tuln | grep ":${port} " || true`, { encoding: 'utf8' });
      if (protocol === 'tcp') {
        return output.includes('tcp') && output.includes(`:${port} `);
      }
      return output.includes('udp') && output.includes(`:${port} `);
    } catch {
      return false;
    }
  }

  /**
   * 清理所有跟踪的规则
   */
  cleanupAll() {
    for (const [instanceId] of this.activeRules) {
      this.removeDnatRules(instanceId);
    }
  }
}

// 单例
const portMapper = new PortMapper();

module.exports = { portMapper, PortMapper };
