import axios from 'axios';
import { G4FService } from '../services/G4FService';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('G4FService', () => {
  let g4fService: G4FService;
  let mockAxiosInstance: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock axios instance
    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
      interceptors: {
        response: {
          use: jest.fn(),
        },
      },
    };
    
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    
    // Create service instance
    g4fService = new G4FService();
  });

  describe('constructor', () => {
    it('should create axios instance with correct config', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:5001',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should use environment variables for configuration', () => {
      process.env.G4F_SERVICE_URL = 'http://test:8000';
      process.env.G4F_SERVICE_TIMEOUT = '15000';
      
      new G4FService();
      
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://test:8000',
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      // Clean up
      delete process.env.G4F_SERVICE_URL;
      delete process.env.G4F_SERVICE_TIMEOUT;
    });
  });

  describe('sendToProvider', () => {
    it('should send message successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'Hello! How can I help you?',
          provider: 'bing',
          timestamp: '2023-01-01T00:00:00Z',
        },
      };
      
      mockAxiosInstance.post.mockResolvedValue(mockResponse);
      
      const result = await g4fService.sendToProvider('Hello', 'bing');
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/chat', {
        message: 'Hello',
        provider: 'bing',
        model: 'gpt-3.5-turbo',
      });
      
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle custom model parameter', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'Response',
          provider: 'bing',
        },
      };
      
      mockAxiosInstance.post.mockResolvedValue(mockResponse);
      
      await g4fService.sendToProvider('Hello', 'bing', 'gpt-4');
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/chat', {
        message: 'Hello',
        provider: 'bing',
        model: 'gpt-4',
      });
    });

    it('should handle G4F service error response', async () => {
      const mockResponse = {
        data: {
          success: false,
          error: 'Provider not available',
          provider: 'bing',
        },
      };
      
      mockAxiosInstance.post.mockResolvedValue(mockResponse);
      
      const result = await g4fService.sendToProvider('Hello', 'bing');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Provider not available');
    });

    it('should retry on rate limit errors', async () => {
      const rateLimitError = {
        response: {
          status: 429,
          data: { error: 'Rate limit exceeded' },
        },
        message: 'Rate limit exceeded',
      };
      
      const successResponse = {
        data: {
          success: true,
          message: 'Success after retry',
          provider: 'bing',
        },
      };
      
      mockAxiosInstance.post
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce(successResponse);
      
      const result = await g4fService.sendToProvider('Hello', 'bing');
      
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Success after retry');
    });

    it('should retry on connection errors', async () => {
      const connectionError = {
        code: 'ECONNREFUSED',
        message: 'Connection refused',
      };
      
      const successResponse = {
        data: {
          success: true,
          message: 'Success after retry',
          provider: 'bing',
        },
      };
      
      mockAxiosInstance.post
        .mockRejectedValueOnce(connectionError)
        .mockResolvedValueOnce(successResponse);
      
      const result = await g4fService.sendToProvider('Hello', 'bing');
      
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
    });

    it('should fail after max retries', async () => {
      const error = {
        response: {
          status: 429,
          data: { error: 'Rate limit exceeded' },
        },
        message: 'Rate limit exceeded',
      };
      
      mockAxiosInstance.post.mockRejectedValue(error);
      
      const result = await g4fService.sendToProvider('Hello', 'bing');
      
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(3); // Max retries
      expect(result.success).toBe(false);
      expect(result.error).toBe('Rate limit exceeded');
    });

    it('should not retry on non-retryable errors', async () => {
      const error = {
        response: {
          status: 400,
          data: { error: 'Bad request' },
        },
        message: 'Bad request',
      };
      
      mockAxiosInstance.post.mockRejectedValue(error);
      
      const result = await g4fService.sendToProvider('Hello', 'bing');
      
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1); // No retries
      expect(result.success).toBe(false);
      expect(result.error).toBe('Bad request');
    });
  });

  describe('getAvailableProviders', () => {
    it('should fetch and cache providers', async () => {
      const mockResponse = {
        data: {
          success: true,
          providers: [
            {
              id: 'bing',
              name: 'Bing',
              status: 'available',
              last_checked: '2023-01-01T00:00:00Z',
              model: 'gpt-3.5-turbo',
            },
            {
              id: 'chatgptai',
              name: 'ChatGPT AI',
              status: 'rate_limited',
              last_checked: '2023-01-01T00:00:00Z',
            },
          ],
          count: 2,
        },
      };
      
      mockAxiosInstance.get.mockResolvedValue(mockResponse);
      
      const result = await g4fService.getAvailableProviders();
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/providers');
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'bing',
        name: 'Bing',
        status: 'available',
        model: 'gpt-3.5-turbo',
      });
      expect(result[1]).toMatchObject({
        id: 'chatgptai',
        name: 'ChatGPT AI',
        status: 'rate_limited',
      });
    });

    it('should return cached providers on subsequent calls', async () => {
      const mockResponse = {
        data: {
          success: true,
          providers: [
            {
              id: 'bing',
              name: 'Bing',
              status: 'available',
              last_checked: '2023-01-01T00:00:00Z',
            },
          ],
          count: 1,
        },
      };
      
      mockAxiosInstance.get.mockResolvedValue(mockResponse);
      
      // First call
      await g4fService.getAvailableProviders();
      
      // Second call should use cache
      const result = await g4fService.getAvailableProviders();
      
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
    });

    it('should return empty array on error with no cache', async () => {
      const error = new Error('Network error');
      mockAxiosInstance.get.mockRejectedValue(error);
      
      const result = await g4fService.getAvailableProviders();
      
      expect(result).toEqual([]);
    });

    it('should return stale cache on error when cache exists', async () => {
      const mockResponse = {
        data: {
          success: true,
          providers: [
            {
              id: 'bing',
              name: 'Bing',
              status: 'available',
              last_checked: '2023-01-01T00:00:00Z',
            },
          ],
          count: 1,
        },
      };
      
      // First successful call to populate cache
      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);
      const firstResult = await g4fService.getAvailableProviders();
      expect(firstResult).toHaveLength(1);
      
      // Simulate cache expiry by manipulating the internal cache expiry
      // We'll use a private property access for testing
      (g4fService as any).cacheExpiry = 0; // Force cache to be considered expired
      
      // Next call should try to refresh but fail, returning stale cache
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));
      const result = await g4fService.getAvailableProviders();
      
      expect(result).toHaveLength(1); // Should return stale cached data
      expect(result[0].id).toBe('bing');
    });
  });

  describe('testProvider', () => {
    it('should test provider successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          result: {
            provider: 'bing',
            status: 'available',
            last_checked: '2023-01-01T00:00:00Z',
          },
        },
      };
      
      mockAxiosInstance.post.mockResolvedValue(mockResponse);
      
      const result = await g4fService.testProvider('bing');
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/providers/bing/test');
      expect(result).toMatchObject({
        provider: 'bing',
        status: 'available',
        lastChecked: expect.any(Date),
      });
    });

    it('should handle provider test failure', async () => {
      const mockResponse = {
        data: {
          success: false,
          error: 'Provider not found',
        },
      };
      
      mockAxiosInstance.post.mockResolvedValue(mockResponse);
      
      const result = await g4fService.testProvider('invalid');
      
      expect(result).toMatchObject({
        provider: 'invalid',
        status: 'unavailable',
        error: 'Provider not found',
      });
    });

    it('should handle network errors', async () => {
      const error = new Error('Network error');
      mockAxiosInstance.post.mockRejectedValue(error);
      
      const result = await g4fService.testProvider('bing');
      
      expect(result).toMatchObject({
        provider: 'bing',
        status: 'unavailable',
        error: 'Network error',
      });
    });
  });

  describe('checkHealth', () => {
    it('should return true for healthy service', async () => {
      const mockResponse = {
        data: {
          status: 'healthy',
          timestamp: '2023-01-01T00:00:00Z',
          service: 'g4f-wrapper',
        },
      };
      
      mockAxiosInstance.get.mockResolvedValue(mockResponse);
      
      const result = await g4fService.checkHealth();
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/health');
      expect(result).toBe(true);
    });

    it('should return false for unhealthy service', async () => {
      const mockResponse = {
        data: {
          status: 'unhealthy',
        },
      };
      
      mockAxiosInstance.get.mockResolvedValue(mockResponse);
      
      const result = await g4fService.checkHealth();
      
      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      const error = new Error('Network error');
      mockAxiosInstance.get.mockRejectedValue(error);
      
      const result = await g4fService.checkHealth();
      
      expect(result).toBe(false);
    });
  });

  describe('cache management', () => {
    it('should clear cache', () => {
      g4fService.clearCache();
      
      const status = g4fService.getCacheStatus();
      expect(status.cached).toBe(0);
      expect(status.expiresAt).toBeNull();
      expect(status.isExpired).toBe(true);
    });

    it('should provide cache status', async () => {
      const mockResponse = {
        data: {
          success: true,
          providers: [
            {
              id: 'bing',
              name: 'Bing',
              status: 'available',
              last_checked: '2023-01-01T00:00:00Z',
            },
          ],
          count: 1,
        },
      };
      
      mockAxiosInstance.get.mockResolvedValue(mockResponse);
      
      await g4fService.getAvailableProviders();
      
      const status = g4fService.getCacheStatus();
      expect(status.cached).toBe(1);
      expect(status.expiresAt).toBeInstanceOf(Date);
      expect(status.isExpired).toBe(false);
    });
  });
});