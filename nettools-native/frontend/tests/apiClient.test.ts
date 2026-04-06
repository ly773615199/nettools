import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '../src/core/api/apiClient';
import { configService } from '../src/core/config/configService';

// 模拟localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// 模拟fetch
global.fetch = vi.fn();

const mockResponse = (data: any, status: number = 200) => {
  return {
    ok: status === 200,
    status,
    json: () => Promise.resolve(data),
  };
};

describe('ApiClient', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    apiClient = new ApiClient();
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  describe('get method', () => {
    it('should return data on successful request', async () => {
      const testData = { data: { id: 1, name: 'test' }, total: 1 };
      (global.fetch as any).mockResolvedValue(mockResponse(testData));

      const response = await apiClient.get('/test');

      expect(response).toEqual(testData);
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8000/api/test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should handle 401 error', async () => {
      const errorData = { error: 'Unauthorized' };
      (global.fetch as any).mockResolvedValue(mockResponse(errorData, 401));

      const response = await apiClient.get('/test');

      expect(response.data).toBeUndefined();
      expect(response.error).toBe('Unauthorized');
    });

    it('should handle network error', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const response = await apiClient.get('/test');

      expect(response.data).toBeUndefined();
      expect(response.error).toBe('Network error');
    });
  });

  describe('post method', () => {
    it('should send POST request with data', async () => {
      const testData = { id: 1, name: 'test' };
      const responseData = { message: 'Success' };
      (global.fetch as any).mockResolvedValue(mockResponse(responseData));

      const response = await apiClient.post('/test', testData);

      expect(response).toEqual(responseData);
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8000/api/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData),
      });
    });
  });

  describe('authentication', () => {
    it('should include authorization header when token is set', async () => {
      const testData = { data: { id: 1, name: 'test' } };
      (global.fetch as any).mockResolvedValue(mockResponse(testData));

      // Set auth token
      configService.setAuthToken('test-token');

      await apiClient.get('/test');

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8000/api/test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
      });
    });
  });

  describe('login method', () => {
    it('should handle successful login', async () => {
      const loginData = { username: 'admin', password: 'password' };
      const responseData = {
        token: 'test-token',
        user: { id: 1, username: 'admin' },
      };
      (global.fetch as any).mockResolvedValue(mockResponse(responseData));

      const response = await apiClient.login(loginData.username, loginData.password);

      expect(response).toEqual(responseData);
      const callArgs = (global.fetch as any).mock.calls[0];
      expect(callArgs[0]).toBe('http://localhost:8000/api/auth/login');
      expect(callArgs[1].method).toBe('POST');
      expect(callArgs[1].body).toBe(JSON.stringify(loginData));
      expect(callArgs[1].headers['Content-Type']).toBe('application/json');
    });
  });
});
