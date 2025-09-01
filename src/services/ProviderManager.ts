import { Provider } from '@shared/types';
import { G4FService } from './G4FService';

export interface ProviderSelectionStrategy {
  selectProvider(providers: Provider[]): Provider | null;
}

export class RoundRobinStrategy implements ProviderSelectionStrategy {
  private currentIndex = 0;

  selectProvider(providers: Provider[]): Provider | null {
    const availableProviders = providers.filter(p => p.status === 'available');
    if (availableProviders.length === 0) return null;

    const provider = availableProviders[this.currentIndex % availableProviders.length];
    this.currentIndex = (this.currentIndex + 1) % availableProviders.length;
    return provider;
  }
}

export class RandomStrategy implements ProviderSelectionStrategy {
  selectProvider(providers: Provider[]): Provider | null {
    const availableProviders = providers.filter(p => p.status === 'available');
    if (availableProviders.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * availableProviders.length);
    return availableProviders[randomIndex];
  }
}

export class PriorityStrategy implements ProviderSelectionStrategy {
  private priorityOrder: string[];

  constructor(priorityOrder: string[] = ['bing', 'chatgptai', 'you', 'freegpt']) {
    this.priorityOrder = priorityOrder;
  }

  selectProvider(providers: Provider[]): Provider | null {
    const availableProviders = providers.filter(p => p.status === 'available');
    if (availableProviders.length === 0) return null;

    // Find the highest priority available provider
    for (const priorityId of this.priorityOrder) {
      const provider = availableProviders.find(p => p.id === priorityId);
      if (provider) return provider;
    }

    // If no priority provider found, return the first available
    return availableProviders[0];
  }
}

export interface ProviderHealthStatus {
  providerId: string;
  isHealthy: boolean;
  lastChecked: Date;
  consecutiveFailures: number;
  error?: string;
}

export class ProviderManager {
  private g4fService: G4FService;
  private selectionStrategy: ProviderSelectionStrategy;
  private healthCheckInterval: number;
  private healthCheckTimer?: NodeJS.Timeout;
  private providerHealth: Map<string, ProviderHealthStatus> = new Map();
  private maxConsecutiveFailures: number;
  private healthCheckEnabled: boolean;

  constructor(
    g4fService?: G4FService,
    selectionStrategy?: ProviderSelectionStrategy,
    options: {
      healthCheckInterval?: number;
      maxConsecutiveFailures?: number;
      enableHealthCheck?: boolean;
    } = {}
  ) {
    this.g4fService = g4fService || new G4FService();
    this.selectionStrategy = selectionStrategy || new PriorityStrategy();
    this.healthCheckInterval = options.healthCheckInterval || 5 * 60 * 1000; // 5 minutes
    this.maxConsecutiveFailures = options.maxConsecutiveFailures || 3;
    this.healthCheckEnabled = options.enableHealthCheck !== false;

    if (this.healthCheckEnabled) {
      this.startPeriodicHealthCheck();
    }
  }

  /**
   * Get all available providers with their current status
   */
  async getAvailableProviders(): Promise<Provider[]> {
    try {
      const providers = await this.g4fService.getAvailableProviders();
      
      // Update provider health status based on G4F service data
      for (const provider of providers) {
        this.updateProviderHealth(provider.id, provider.status === 'available');
      }

      return providers;
    } catch (error) {
      console.error('ProviderManager: Error getting providers', { error });
      return [];
    }
  }

  /**
   * Select the best available provider based on the current strategy
   */
  async selectProvider(preferredProvider?: string): Promise<Provider | null> {
    const providers = await this.getAvailableProviders();
    
    // If a preferred provider is specified and available, use it
    if (preferredProvider) {
      const preferred = providers.find(p => 
        p.id === preferredProvider && 
        p.status === 'available' && 
        this.isProviderHealthy(preferredProvider)
      );
      if (preferred) {
        console.log(`ProviderManager: Using preferred provider ${preferredProvider}`);
        return preferred;
      } else {
        console.warn(`ProviderManager: Preferred provider ${preferredProvider} not available, falling back to strategy`);
      }
    }

    // Filter out unhealthy providers
    const healthyProviders = providers.filter(p => 
      p.status === 'available' && this.isProviderHealthy(p.id)
    );

    if (healthyProviders.length === 0) {
      console.warn('ProviderManager: No healthy providers available');
      return null;
    }

    const selected = this.selectionStrategy.selectProvider(healthyProviders);
    if (selected) {
      console.log(`ProviderManager: Selected provider ${selected.id} using ${this.selectionStrategy.constructor.name}`);
    }

    return selected;
  }

  /**
   * Switch to a different selection strategy
   */
  setSelectionStrategy(strategy: ProviderSelectionStrategy): void {
    this.selectionStrategy = strategy;
    console.log(`ProviderManager: Switched to ${strategy.constructor.name}`);
  }

  /**
   * Test a specific provider's health
   */
  async testProviderHealth(providerId: string): Promise<ProviderHealthStatus> {
    try {
      console.log(`ProviderManager: Testing health of provider ${providerId}`);
      
      const result = await this.g4fService.testProvider(providerId);
      const isHealthy = result.status === 'available';
      
      this.updateProviderHealth(providerId, isHealthy, result.error);
      
      return this.providerHealth.get(providerId)!;
    } catch (error) {
      console.error(`ProviderManager: Error testing provider ${providerId}`, { error });
      
      this.updateProviderHealth(providerId, false, error instanceof Error ? error.message : 'Unknown error');
      return this.providerHealth.get(providerId)!;
    }
  }

  /**
   * Get health status for all tracked providers
   */
  getProviderHealthStatus(): ProviderHealthStatus[] {
    return Array.from(this.providerHealth.values());
  }

  /**
   * Get health status for a specific provider
   */
  getProviderHealth(providerId: string): ProviderHealthStatus | undefined {
    return this.providerHealth.get(providerId);
  }

  /**
   * Mark a provider as failed (called when a request fails)
   */
  markProviderFailure(providerId: string, error?: string): void {
    console.warn(`ProviderManager: Marking provider ${providerId} as failed`, { error });
    this.updateProviderHealth(providerId, false, error);
  }

  /**
   * Mark a provider as successful (called when a request succeeds)
   */
  markProviderSuccess(providerId: string): void {
    console.log(`ProviderManager: Marking provider ${providerId} as successful`);
    this.updateProviderHealth(providerId, true);
  }

  /**
   * Get fallback providers when the primary provider fails
   */
  async getFallbackProviders(excludeProviders: string[] = []): Promise<Provider[]> {
    const allProviders = await this.getAvailableProviders();
    
    return allProviders
      .filter(p => 
        !excludeProviders.includes(p.id) && 
        p.status === 'available' && 
        this.isProviderHealthy(p.id)
      )
      .sort((a, b) => {
        // Sort by health score (fewer failures first)
        const healthA = this.providerHealth.get(a.id);
        const healthB = this.providerHealth.get(b.id);
        const failuresA = healthA?.consecutiveFailures || 0;
        const failuresB = healthB?.consecutiveFailures || 0;
        return failuresA - failuresB;
      });
  }

  /**
   * Start periodic health checking
   */
  startPeriodicHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    console.log(`ProviderManager: Starting periodic health check (interval: ${this.healthCheckInterval}ms)`);
    
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.healthCheckInterval);
  }

  /**
   * Stop periodic health checking
   */
  stopPeriodicHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
      console.log('ProviderManager: Stopped periodic health check');
    }
  }

  /**
   * Perform health check on all providers
   */
  async performHealthCheck(): Promise<void> {
    try {
      console.log('ProviderManager: Performing periodic health check');
      
      const providers = await this.g4fService.getAvailableProviders();
      
      // Test each provider's health
      const healthCheckPromises = providers.map(async (provider) => {
        try {
          await this.testProviderHealth(provider.id);
        } catch (error) {
          console.error(`ProviderManager: Health check failed for ${provider.id}`, { error });
        }
      });

      await Promise.allSettled(healthCheckPromises);
      
      const healthyCount = Array.from(this.providerHealth.values())
        .filter(h => h.isHealthy).length;
      
      console.log(`ProviderManager: Health check completed. ${healthyCount}/${providers.length} providers healthy`);
    } catch (error) {
      console.error('ProviderManager: Error during health check', { error });
    }
  }

  /**
   * Get statistics about provider usage and health
   */
  getStatistics(): {
    totalProviders: number;
    healthyProviders: number;
    unhealthyProviders: number;
    averageConsecutiveFailures: number;
    lastHealthCheck: Date | null;
  } {
    const healthStatuses = Array.from(this.providerHealth.values());
    const healthyCount = healthStatuses.filter(h => h.isHealthy).length;
    const totalFailures = healthStatuses.reduce((sum, h) => sum + h.consecutiveFailures, 0);
    const lastHealthCheck = healthStatuses.length > 0 
      ? new Date(Math.max(...healthStatuses.map(h => h.lastChecked.getTime())))
      : null;

    return {
      totalProviders: healthStatuses.length,
      healthyProviders: healthyCount,
      unhealthyProviders: healthStatuses.length - healthyCount,
      averageConsecutiveFailures: healthStatuses.length > 0 ? totalFailures / healthStatuses.length : 0,
      lastHealthCheck,
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopPeriodicHealthCheck();
    this.providerHealth.clear();
    console.log('ProviderManager: Destroyed');
  }

  // Private helper methods

  private updateProviderHealth(providerId: string, isHealthy: boolean, error?: string): void {
    const existing = this.providerHealth.get(providerId);
    
    const updated: ProviderHealthStatus = {
      providerId,
      isHealthy,
      lastChecked: new Date(),
      consecutiveFailures: isHealthy 
        ? 0 
        : (existing?.consecutiveFailures || 0) + 1,
      error: isHealthy ? undefined : error,
    };

    this.providerHealth.set(providerId, updated);
  }

  private isProviderHealthy(providerId: string): boolean {
    const health = this.providerHealth.get(providerId);
    if (!health) return true; // Assume healthy if no data

    return health.isHealthy && health.consecutiveFailures < this.maxConsecutiveFailures;
  }
}