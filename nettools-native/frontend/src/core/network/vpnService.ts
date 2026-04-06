import type { ApiResponse } from '../types';
import { apiClient } from '../api/apiClient';

// VPN服务器配置接口
export interface VpnServerConfig {
  id: string;
  name: string;
  type: 'openvpn' | 'wireguard' | 'ikev2';
  server: string;
  port: number;
  protocol: 'udp' | 'tcp';
  username?: string;
  password?: string;
  cert?: string;
  key?: string;
  status: 'connected' | 'disconnected' | 'error';
  running?: boolean;
  uptime?: string;
  lastConnected?: Date;
  config: Record<string, any>;
}

// VPN客户端配置接口
export interface VpnClientConfig {
  id: string;
  name: string;
  type: 'openvpn' | 'wireguard' | 'ikev2';
  server: string;
  port: number;
  protocol: 'udp' | 'tcp';
  username?: string;
  password?: string;
  cert?: string;
  key?: string;
  config: string;
}

/**
 * VPN 服务类 — 全部对接后端 API
 */
export class VpnService {
  // 获取VPN服务器列表
  async getVpnServers(): Promise<ApiResponse<VpnServerConfig[]>> {
    const response = await apiClient.get<{ data: VpnServerConfig[]; total: number }>('/vpn/servers');
    return {
      data: response.data?.data || [],
      error: response.error,
    };
  }

  // 创建VPN服务器
  async createVpnServer(server: Omit<VpnServerConfig, 'id' | 'status' | 'lastConnected'>): Promise<ApiResponse<VpnServerConfig>> {
    const response = await apiClient.post<{ data: VpnServerConfig; message: string }>('/vpn/servers', server);
    return {
      data: response.data?.data,
      message: response.data?.message,
      error: response.error,
    };
  }

  // 删除VPN服务器
  async deleteVpnServer(id: string): Promise<ApiResponse<void>> {
    const response = await apiClient.delete<{ message: string }>(`/vpn/servers/${id}`);
    return {
      data: undefined,
      message: response.data?.message,
      error: response.error,
    };
  }

  // 连接VPN服务器
  async connectVpnServer(id: string): Promise<ApiResponse<void>> {
    const response = await apiClient.post<{ message: string; data: { status: string } }>(`/vpn/servers/${id}/connect`, {});
    return {
      data: undefined,
      message: response.data?.message,
      error: response.error,
    };
  }

  // 断开VPN服务器
  async disconnectVpnServer(id: string): Promise<ApiResponse<void>> {
    const response = await apiClient.post<{ message: string }>(`/vpn/servers/${id}/disconnect`, {});
    return {
      data: undefined,
      message: response.data?.message,
      error: response.error,
    };
  }

  // 获取VPN服务器状态
  async getVpnServerStatus(id: string): Promise<ApiResponse<VpnServerConfig>> {
    const response = await apiClient.get<{ data: VpnServerConfig }>(`/vpn/servers/${id}`);
    return {
      data: response.data?.data,
      error: response.error,
    };
  }

  // 生成VPN客户端配置
  async generateVpnClientConfig(server: VpnServerConfig): Promise<ApiResponse<VpnClientConfig>> {
    let config = '';
    switch (server.type) {
      case 'openvpn':
        config = `client\ndev tun\nproto ${server.protocol}\nremote ${server.server} ${server.port}\nresolv-retry infinite\nnobind\npersist-key\npersist-tun\nremote-cert-tls server\ncipher AES-256-CBC\nverb 3`;
        break;
      case 'wireguard':
        config = `[Interface]\nPrivateKey = <client-private-key>\nAddress = 10.0.0.2/24\nDNS = 8.8.8.8\n\n[Peer]\nPublicKey = <server-public-key>\nEndpoint = ${server.server}:${server.port}\nAllowedIPs = 0.0.0.0/0`;
        break;
      case 'ikev2':
        config = `[VPN]\nType = IKEv2\nName = ${server.name}\nServerAddress = ${server.server}\nServerPort = ${server.port}\nAuthenticationMethod = EAP\nUsername = ${server.username}\nPassword = ${server.password}`;
        break;
    }
    const clientConfig: VpnClientConfig = {
      id: `client_${Date.now()}`,
      name: `${server.name} Client`,
      type: server.type,
      server: server.server,
      port: server.port,
      protocol: server.protocol,
      username: server.username,
      password: server.password,
      config,
    };
    return { data: clientConfig, message: 'VPN client config generated' };
  }

  // 测试VPN服务器连接
  async testVpnServerConnection(server: VpnServerConfig): Promise<ApiResponse<{ status: string; latency: number }>> {
    if (!server.id) {
      return { data: { status: 'error', latency: 0 }, error: 'Server ID required for test' };
    }
    const response = await apiClient.post<{ data: { status: string; latency: number } }>(`/vpn/servers/${server.id}/test`, {});
    return {
      data: response.data?.data || { status: 'error', latency: 0 },
      error: response.error,
    };
  }

  // 获取VPN类型列表
  async getVpnTypes(): Promise<ApiResponse<Array<{ type: string; name: string; description: string }>>> {
    return {
      data: [
        { type: 'openvpn', name: 'OpenVPN', description: 'Open-source VPN protocol with wide compatibility' },
        { type: 'wireguard', name: 'WireGuard', description: 'Modern, fast, and secure VPN protocol' },
        { type: 'ikev2', name: 'IKEv2', description: 'Secure and stable VPN protocol for mobile devices' },
      ],
    };
  }

  // 导入VPN配置 — 创建服务器并保存
  async importVpnConfig(configContent: string): Promise<ApiResponse<VpnServerConfig>> {
    // 简单解析配置，提取关键字段
    const lines = configContent.split('\n');
    let name = 'Imported VPN';
    let type: 'openvpn' | 'wireguard' | 'ikev2' = 'openvpn';
    let server = '';
    let port = 1194;
    let protocol: 'udp' | 'tcp' = 'udp';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('remote ')) {
        const parts = trimmed.split(/\s+/);
        server = parts[1] || '';
        port = Number(parts[2]) || 1194;
      }
      if (trimmed.startsWith('proto ')) {
        protocol = (trimmed.split(/\s+/)[1] as 'udp' | 'tcp') || 'udp';
      }
      if (trimmed.includes('wireguard') || trimmed.includes('[Interface]')) {
        type = 'wireguard';
        port = port || 51820;
      }
      if (trimmed.includes('Endpoint')) {
        const match = trimmed.match(/=\s*(.+):(\d+)/);
        if (match) { server = match[1]; port = Number(match[2]); }
      }
    }

    return this.createVpnServer({ name, type, server, port, protocol, config: {} });
  }

  // 导出VPN配置
  async exportVpnConfig(id: string): Promise<ApiResponse<{ config: string }>> {
    const serverResp = await this.getVpnServerStatus(id);
    if (!serverResp.data) return { data: { config: '' }, error: serverResp.error };

    const s = serverResp.data;
    let config = '';
    switch (s.type) {
      case 'openvpn':
        config = `# OpenVPN Server Config\nport ${s.port}\nproto ${s.protocol}\ndev tun\nca ca.crt\ncert server.crt\nkey server.key\ndh dh.pem\nserver 10.8.0.0 255.255.255.0\nkeepalive 10 120\ncipher AES-256-CBC\npersist-key\npersist-tun\nverb 3`;
        break;
      case 'wireguard':
        config = `# WireGuard Server Config\n[Interface]\nAddress = 10.0.0.1/24\nListenPort = ${s.port}\nPrivateKey = <server-private-key>\n\n[Peer]\nPublicKey = <client-public-key>\nAllowedIPs = 10.0.0.2/32`;
        break;
      case 'ikev2':
        config = `# IKEv2 Server Config\nconn %default\n  ikev2=insist\n  keyexchange=ikev2\n  ike=aes256-sha256-modp2048\n  esp=aes256-sha256\n  left=%any\n  right=%any\n  rightauth=eap-mschapv2\n  rightsourceip=10.0.0.0/24`;
        break;
    }
    return { data: { config }, message: 'VPN config exported' };
  }
}

// 导出VPN服务实例
export const vpnService = new VpnService();
