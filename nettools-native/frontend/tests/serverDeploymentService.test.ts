import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServerDeploymentService, ServerDeploymentConfig } from '../src/core/services/serverDeploymentService';

describe('ServerDeploymentService', () => {
  let deploymentService: ServerDeploymentService;
  
  beforeEach(() => {
    deploymentService = new ServerDeploymentService();
    vi.clearAllMocks();
  });
  
  describe('getServerDeployments', () => {
    it('should get server deployments successfully', async () => {
      const result = await deploymentService.getServerDeployments();
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].type).toBe('tunnel');
      expect(result.data?.[1].type).toBe('vpn');
    });
  });
  
  describe('createServerDeployment', () => {
    it('should create server deployment successfully', async () => {
      const newDeployment = {
        name: 'Test Tunnel Server',
        type: 'tunnel' as const,
        provider: 'aws' as const,
        region: 'us-east-1',
        instanceType: 't2.micro',
        sshKey: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ...',
        domain: 'test-tunnel.example.com',
        port: 2222,
        authToken: 'test-token',
      };
      const result = await deploymentService.createServerDeployment(newDeployment);
      expect(result.data?.id).toBeDefined();
      expect(result.data?.status).toBe('deploying');
      expect(result.message).toBe('Server deployment created successfully');
    });
  });
  
  describe('deleteServerDeployment', () => {
    it('should delete server deployment successfully', async () => {
      const result = await deploymentService.deleteServerDeployment('1');
      expect(result.data).toBeUndefined();
      expect(result.message).toBe('Server deployment deleted successfully');
    });
  });
  
  describe('startServerDeployment', () => {
    it('should start server deployment successfully', async () => {
      const result = await deploymentService.startServerDeployment('1');
      expect(result.data).toBeUndefined();
      expect(result.message).toBe('Server deployment started successfully');
    });
  });
  
  describe('stopServerDeployment', () => {
    it('should stop server deployment successfully', async () => {
      const result = await deploymentService.stopServerDeployment('1');
      expect(result.data).toBeUndefined();
      expect(result.message).toBe('Server deployment stopped successfully');
    });
  });
  
  describe('getServerDeploymentStatus', () => {
    it('should get server deployment status successfully', async () => {
      const result = await deploymentService.getServerDeploymentStatus('1');
      expect(result.data?.id).toBe('1');
      expect(result.data?.status).toBe('running');
    });
    
    it('should handle non-existent deployment', async () => {
      const result = await deploymentService.getServerDeploymentStatus('999');
      expect(result.data).toBeUndefined();
      expect(result.error).toBe('Server deployment not found');
    });
  });
  
  describe('getAvailableProviders', () => {
    it('should get available providers successfully', async () => {
      const result = await deploymentService.getAvailableProviders();
      expect(result.data).toHaveLength(5);
      expect(result.data?.[0].name).toBe('aws');
      expect(result.data?.[0].regions).toHaveLength(5);
    });
  });
  
  describe('getAvailableInstanceTypes', () => {
    it('should get available instance types for AWS successfully', async () => {
      const result = await deploymentService.getAvailableInstanceTypes('aws');
      expect(result.data).toHaveLength(5);
      expect(result.data?.[0]).toBe('t2.micro');
    });
    
    it('should return empty array for unknown provider', async () => {
      const result = await deploymentService.getAvailableInstanceTypes('unknown');
      expect(result.data).toHaveLength(0);
    });
  });
  
  describe('generateServerDeploymentConfig', () => {
    it('should generate server deployment config successfully', async () => {
      const deployment = {
        name: 'Test VPN Server',
        type: 'vpn' as const,
        provider: 'digitalocean' as const,
        region: 'nyc1',
        instanceType: 's-1vcpu-1gb',
        sshKey: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ...',
        domain: 'test-vpn.example.com',
        port: 8080,
        authToken: 'test-token',
      };
      const result = await deploymentService.generateServerDeploymentConfig(deployment);
      expect(result.data?.config).toBeDefined();
      expect(result.message).toBe('Server deployment config generated successfully');
    });
  });
  
  describe('testServerConnection', () => {
    it('should test server connection successfully', async () => {
      const result = await deploymentService.testServerConnection('203.0.113.1', 2222, 'test-token');
      expect(result.data?.status).toBe('success');
      expect(result.data?.latency).toBe(15.5);
      expect(result.message).toBe('Server connection test completed');
    });
  });
});