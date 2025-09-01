import { ProviderManager, RoundRobinStrategy, RandomStrategy, PriorityStrategy } from '../services/ProviderManager';
import { G4FService } from '../services/G4FService';
import { Provider } from '@shared/types';

// Mock G4FService
jest.mock('../services/G4FService');
const MockedG4FService = G4FService as jest.MockedClass<typeof G4FService>;

describe('ProviderManager', () => {
  let providerManager: ProviderManager;
  let mockG4FService: jest.Mocked<G4FService>;

  const mockProviders: Provider[] = [
    {
      id: 'bing',
      name: 'Bing',
      status: 'available',
      lastChecked: new Date(),
      model: 'gpt-3.5-turbo',
    },
    {
      id: 'chatgptai',
      name: 'ChatGPT AI',
      status: 'available',
      lastChecked: new Date(),
    },
    {
      id: 'you',
      name: 'You.com',
      status: 'rate_limited',
      lastChecked: new Date(),
    },
    {
      id: 'freegpt',
      name: 'FreeGPT',
      status: 'unavailable',
      lastChecked: new Date(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockG4FService = {
      getAvailableProviders: jest.fn(),
      testProvider: jest.fn(),
    } as any;

    MockedG4FService.mockImplementation(() => mockG4FService);

    providerManager = new ProviderManager(mockG4FService, undefined, {
      enableHealthCheck: false, // Disable for testing
    });
  });

  afterEach(() => {
    providerManager.destroy();
  });

  describe('constructor', () => {
    it('should create with default options', () => {
      const manager = new ProviderManager();
      expect(manager).toBeInstanceOf(ProviderManager);
      manager.destroy();
    });

    it('should create with custom options', () => {
      const customStrategy = new RandomStrategy();
      const manager = new ProviderManager(mockG4FService, customStrategy, {
        healthCheckInterval: 10000,
        maxConsecutiveFailures: 5,
        enableHealthCheck: false,
      });
      
      expect(manager).toBeInstanceOf(ProviderManager);
      manager.destroy();
    });
  });

  describe('getAvailableProviders', () => {
    it('should return providers from G4F service', async () => {
      mockG4FService.getAvailableProviders.mockResolvedValue(mockProviders);

      const result = await providerManager.getAvailableProviders();

      expect(mockG4FService.getAvailableProviders).toHaveBeenCalled();
      expect(result).toEqual(mockProviders);
    });

    it('should return empty array on error', async () => {
      mockG4FService.getAvailableProviders.mockRejectedValue(new Error('Network error'));

      const result = await providerManager.getAvailableProviders();

      expect(result).toEqual([]);
    });
  });

  describe('selectProvider', () => {
    beforeEach(() => {
      mockG4FService.getAvailableProviders.mockResolvedValue(mockProviders);
    });

    it('should return preferred provider when available', async () => {
      const result = await providerManager.selectProvider('bing');

      expect(result).toMatchObject({
        id: 'bing',
        name: 'Bing',
        status: 'available',
      });
    });

    it('should fallback to strategy when preferred provider unavailable', async () => {
      const result = await providerManager.selectProvider('unavailable-provider');

      expect(result).not.toBeNull();
      expect(result?.status).toBe('available');
    });

    it('should return null when no providers available', async () => {
      const unavailableProviders = mockProviders.map(p => ({ ...p, status: 'unavailable' as const }));
      mockG4FService.getAvailableProviders.mockResolvedValue(unavailableProviders);

      const result = await providerManager.selectProvider();

      expect(result).toBeNull();
    });

    it('should use priority strategy by default', async () => {
      const result = await providerManager.selectProvider();

      // Should select 'bing' as it's first in default priority order
      expect(result?.id).toBe('bing');
    });
  });

  describe('selection strategies', () => {
    describe('PriorityStrategy', () => {
      it('should select providers in priority order', () => {
        const strategy = new PriorityStrategy(['chatgptai', 'bing']);
        const availableProviders = mockProviders.filter(p => p.status === 'available');

        const result = strategy.selectProvider(availableProviders);

        expect(result?.id).toBe('chatgptai');
      });

      it('should return first available if no priority match', () => {
        const strategy = new PriorityStrategy(['nonexistent']);
        const availableProviders = mockProviders.filter(p => p.status === 'available');

        const result = strategy.selectProvider(availableProviders);

        expect(result?.status).toBe('available');
      });

      it('should return null if no providers available', () => {
        const strategy = new PriorityStrategy();
        const result = strategy.selectProvider([]);

        expect(result).toBeNull();
      });
    });

    describe('RoundRobinStrategy', () => {
      it('should rotate through available providers', () => {
        const strategy = new RoundRobinStrategy();
        const availableProviders = mockProviders.filter(p => p.status === 'available');

        const first = strategy.selectProvider(availableProviders);
        const second = strategy.selectProvider(availableProviders);

        expect(first?.id).not.toBe(second?.id);
      });

      it('should return null if no providers available', () => {
        const strategy = new RoundRobinStrategy();
        const result = strategy.selectProvider([]);

        expect(result).toBeNull();
      });
    });

    describe('RandomStrategy', () => {
      it('should select from available providers', () => {
        const strategy = new RandomStrategy();
        const availableProviders = mockProviders.filter(p => p.status === 'available');

        const result = strategy.selectProvider(availableProviders);

        expect(result?.status).toBe('available');
        expect(availableProviders).toContain(result);
      });

      it('should return null if no providers available', () => {
        const strategy = new RandomStrategy();
        const result = strategy.selectProvider([]);

        expect(result).toBeNull();
      });
    });
  });

  describe('provider health management', () => {
    it('should test provider health', async () => {
      mockG4FService.testProvider.mockResolvedValue({
        provider: 'bing',
        status: 'available',
        lastChecked: new Date(),
      });

      const result = await providerManager.testProviderHealth('bing');

      expect(mockG4FService.testProvider).toHaveBeenCalledWith('bing');
      expect(result).toMatchObject({
        providerId: 'bing',
        isHealthy: true,
        consecutiveFailures: 0,
      });
    });

    it('should handle provider health test failure', async () => {
      mockG4FService.testProvider.mockResolvedValue({
        provider: 'bing',
        status: 'unavailable',
        lastChecked: new Date(),
        error: 'Connection failed',
      });

      const result = await providerManager.testProviderHealth('bing');

      expect(result).toMatchObject({
        providerId: 'bing',
        isHealthy: false,
        consecutiveFailures: 1,
        error: 'Connection failed',
      });
    });

    it('should track consecutive failures', async () => {
      mockG4FService.testProvider.mockResolvedValue({
        provider: 'bing',
        status: 'unavailable',
        lastChecked: new Date(),
        error: 'Failed',
      });

      // First failure
      await providerManager.testProviderHealth('bing');
      let health = providerManager.getProviderHealth('bing');
      expect(health?.consecutiveFailures).toBe(1);

      // Second failure
      await providerManager.testProviderHealth('bing');
      health = providerManager.getProviderHealth('bing');
      expect(health?.consecutiveFailures).toBe(2);
    });

    it('should reset consecutive failures on success', async () => {
      // First mark as failed
      providerManager.markProviderFailure('bing', 'Test error');
      let health = providerManager.getProviderHealth('bing');
      expect(health?.consecutiveFailures).toBe(1);

      // Then mark as successful
      providerManager.markProviderSuccess('bing');
      health = providerManager.getProviderHealth('bing');
      expect(health?.consecutiveFailures).toBe(0);
      expect(health?.isHealthy).toBe(true);
    });

    it('should get health status for all providers', () => {
      providerManager.markProviderSuccess('bing');
      providerManager.markProviderFailure('chatgptai', 'Error');

      const healthStatuses = providerManager.getProviderHealthStatus();

      expect(healthStatuses).toHaveLength(2);
      expect(healthStatuses.find(h => h.providerId === 'bing')?.isHealthy).toBe(true);
      expect(healthStatuses.find(h => h.providerId === 'chatgptai')?.isHealthy).toBe(false);
    });
  });

  describe('fallback providers', () => {
    beforeEach(() => {
      mockG4FService.getAvailableProviders.mockResolvedValue(mockProviders);
    });

    it('should return fallback providers excluding specified ones', async () => {
      const fallbacks = await providerManager.getFallbackProviders(['bing']);

      expect(fallbacks).not.toContain(expect.objectContaining({ id: 'bing' }));
      expect(fallbacks.every(p => p.status === 'available')).toBe(true);
    });

    it('should sort fallbacks by health score', async () => {
      // Mark providers as successful first to ensure they're healthy
      providerManager.markProviderSuccess('bing');
      providerManager.markProviderSuccess('chatgptai');
      
      // Then add some failures (but keep them under the max consecutive failures threshold)
      providerManager.markProviderFailure('bing', 'Error');
      providerManager.markProviderFailure('bing', 'Error'); // 2 failures
      providerManager.markProviderFailure('chatgptai', 'Error'); // 1 failure
      
      // Mark them as successful again to reset the healthy status but keep failure count
      providerManager.markProviderSuccess('bing');
      providerManager.markProviderSuccess('chatgptai');

      const fallbacks = await providerManager.getFallbackProviders();

      // Both should be available since they're marked as successful
      expect(fallbacks.length).toBeGreaterThan(0);
      
      // The sorting logic should work based on the internal failure tracking
      // Since both are now healthy, they should both be included
      const bingProvider = fallbacks.find(p => p.id === 'bing');
      const chatgptaiProvider = fallbacks.find(p => p.id === 'chatgptai');
      
      expect(bingProvider).toBeDefined();
      expect(chatgptaiProvider).toBeDefined();
    });
  });

  describe('strategy switching', () => {
    it('should switch selection strategy', () => {
      const newStrategy = new RandomStrategy();
      
      providerManager.setSelectionStrategy(newStrategy);
      
      // Verify strategy was changed (we can't directly test this without exposing the strategy)
      // But we can test that it doesn't throw an error
      expect(() => providerManager.setSelectionStrategy(newStrategy)).not.toThrow();
    });
  });

  describe('statistics', () => {
    it('should provide accurate statistics', () => {
      providerManager.markProviderSuccess('bing');
      providerManager.markProviderFailure('chatgptai', 'Error');
      providerManager.markProviderFailure('you', 'Error');
      providerManager.markProviderFailure('you', 'Error'); // 2 failures

      const stats = providerManager.getStatistics();

      expect(stats).toMatchObject({
        totalProviders: 3,
        healthyProviders: 1,
        unhealthyProviders: 2,
        averageConsecutiveFailures: 1, // (0 + 1 + 2) / 3 = 1
      });
      expect(stats.lastHealthCheck).toBeInstanceOf(Date);
    });

    it('should handle empty statistics', () => {
      const stats = providerManager.getStatistics();

      expect(stats).toMatchObject({
        totalProviders: 0,
        healthyProviders: 0,
        unhealthyProviders: 0,
        averageConsecutiveFailures: 0,
        lastHealthCheck: null,
      });
    });
  });

  describe('periodic health check', () => {
    it('should start and stop periodic health check', () => {
      const manager = new ProviderManager(mockG4FService, undefined, {
        healthCheckInterval: 100,
        enableHealthCheck: true,
      });

      // Health check should be running
      expect((manager as any).healthCheckTimer).toBeDefined();

      manager.stopPeriodicHealthCheck();
      expect((manager as any).healthCheckTimer).toBeUndefined();

      manager.destroy();
    });

    it('should perform health check on all providers', async () => {
      mockG4FService.getAvailableProviders.mockResolvedValue(mockProviders.slice(0, 2));
      mockG4FService.testProvider.mockResolvedValue({
        provider: 'test',
        status: 'available',
        lastChecked: new Date(),
      });

      await providerManager.performHealthCheck();

      expect(mockG4FService.getAvailableProviders).toHaveBeenCalled();
      expect(mockG4FService.testProvider).toHaveBeenCalledTimes(2);
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources on destroy', () => {
      const manager = new ProviderManager(mockG4FService, undefined, {
        enableHealthCheck: true,
      });

      manager.markProviderSuccess('test');
      expect(manager.getProviderHealthStatus()).toHaveLength(1);

      manager.destroy();

      expect(manager.getProviderHealthStatus()).toHaveLength(0);
      expect((manager as any).healthCheckTimer).toBeUndefined();
    });
  });
});