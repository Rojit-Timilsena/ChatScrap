import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { Provider } from '@shared/types';
import { AppError } from '../middleware/errorHandler';

export interface G4FResponse {
  success: boolean;
  message?: string;
  error?: string;
  provider?: string;
  timestamp?: string;
}

export interface G4FProvidersResponse {
  success: boolean;
  providers: Array<{
    id: string;
    name: string;
    status: 'available' | 'unavailable' | 'rate_limited' | 'unknown';
    last_checked: string;
    model?: string;
    error_message?: string;
  }>;
  count: number;
}

export interface G4FHealthResponse {
  status: string;
  timestamp: string;
  service: string;
}

export class G4FService {
  private client: AxiosInstance;
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;
  private retryDelay: number;
  private providersCache: Provider[] = [];
  private cacheExpiry: number = 0;
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.baseUrl = process.env.G4F_SERVICE_URL || 'http://localhost:5001';
    this.timeout = parseInt(process.env.G4F_SERVICE_TIMEOUT || '30000', 10);
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('G4F Service Error:', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          message: error.message,
          data: error.response?.data,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Send message to G4F provider with error handling and retries
   */
  async sendToProvider(
    message: string,
    provider?: string,
    model: string = 'gpt-3.5-turbo'
  ): Promise<G4FResponse> {
    const payload = {
      message,
      provider,
      model,
    };

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`G4F Service: Sending message (attempt ${attempt}/${this.maxRetries})`, {
          provider,
          model,
          messageLength: message.length,
        });

        const response: AxiosResponse<G4FResponse> = await this.client.post('/chat', payload);

        if (response.data.success) {
          console.log('G4F Service: Message sent successfully', {
            provider: response.data.provider,
            responseLength: response.data.message?.length || 0,
          });
          return response.data;
        } else {
          throw new Error(response.data.error || 'Unknown error from G4F service');
        }
      } catch (error) {
        lastError = error as Error;
        
        // Check if it's a rate limit error
        if (this.isRateLimitError(error)) {
          console.warn(`G4F Service: Rate limited on attempt ${attempt}`, { provider });
          if (attempt < this.maxRetries) {
            await this.delay(this.retryDelay * attempt); // Exponential backoff
            continue;
          }
        }
        
        // Check if it's a connection error
        if (this.isConnectionError(error)) {
          console.warn(`G4F Service: Connection error on attempt ${attempt}`, { 
            provider,
            error: this.getErrorMessage(error)
          });
          if (attempt < this.maxRetries) {
            await this.delay(this.retryDelay * attempt);
            continue;
          }
        }

        // For other errors, don't retry
        break;
      }
    }

    // All retries failed
    const errorMessage = this.getErrorMessage(lastError);
    console.error('G4F Service: All retry attempts failed', {
      provider,
      error: errorMessage,
      attempts: this.maxRetries,
    });

    return {
      success: false,
      error: errorMessage,
      provider,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get available providers with caching
   */
  async getAvailableProviders(): Promise<Provider[]> {
    // Check cache first
    if (this.providersCache.length > 0 && Date.now() < this.cacheExpiry) {
      console.log('G4F Service: Returning cached providers');
      return this.providersCache;
    }

    try {
      console.log('G4F Service: Fetching providers from service');
      const response: AxiosResponse<G4FProvidersResponse> = await this.client.get('/providers');

      if (response.data.success) {
        // Convert G4F provider format to our Provider format
        this.providersCache = response.data.providers.map(p => ({
          id: p.id,
          name: p.name,
          status: this.mapProviderStatus(p.status),
          lastChecked: new Date(p.last_checked),
          model: p.model,
        }));

        // Update cache expiry
        this.cacheExpiry = Date.now() + this.cacheTTL;

        console.log(`G4F Service: Cached ${this.providersCache.length} providers`);
        return this.providersCache;
      } else {
        throw new Error('Failed to get providers from G4F service');
      }
    } catch (error) {
      console.error('G4F Service: Error getting providers', { error: this.getErrorMessage(error) });
      
      // Return cached data if available, even if expired
      if (this.providersCache.length > 0) {
        console.warn('G4F Service: Returning stale cached providers due to error');
        return this.providersCache;
      }

      // Return empty array if no cache available
      return [];
    }
  }

  /**
   * Test specific provider health
   */
  async testProvider(providerName: string): Promise<{
    provider: string;
    status: 'available' | 'unavailable' | 'rate_limited';
    lastChecked: Date;
    error?: string;
  }> {
    try {
      console.log(`G4F Service: Testing provider ${providerName}`);
      
      const response = await this.client.post(`/providers/${providerName}/test`);
      
      if (response.data.success) {
        return {
          provider: providerName,
          status: this.mapProviderStatus(response.data.result.status),
          lastChecked: new Date(response.data.result.last_checked),
        };
      } else {
        return {
          provider: providerName,
          status: 'unavailable',
          lastChecked: new Date(),
          error: response.data.error,
        };
      }
    } catch (error) {
      console.error(`G4F Service: Error testing provider ${providerName}`, { error: this.getErrorMessage(error) });
      
      return {
        provider: providerName,
        status: 'unavailable',
        lastChecked: new Date(),
        error: this.getErrorMessage(error),
      };
    }
  }

  /**
   * Check if G4F service is healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response: AxiosResponse<G4FHealthResponse> = await this.client.get('/health');
      return response.data.status === 'healthy';
    } catch (error) {
      console.error('G4F Service: Health check failed', { error: this.getErrorMessage(error) });
      return false;
    }
  }

  /**
   * Clear providers cache
   */
  clearCache(): void {
    this.providersCache = [];
    this.cacheExpiry = 0;
    console.log('G4F Service: Cache cleared');
  }

  /**
   * Get cache status
   */
  getCacheStatus(): {
    cached: number;
    expiresAt: Date | null;
    isExpired: boolean;
  } {
    return {
      cached: this.providersCache.length,
      expiresAt: this.cacheExpiry > 0 ? new Date(this.cacheExpiry) : null,
      isExpired: Date.now() >= this.cacheExpiry,
    };
  }

  // Private helper methods

  private mapProviderStatus(status: string): 'available' | 'unavailable' | 'rate_limited' {
    switch (status) {
      case 'available':
        return 'available';
      case 'rate_limited':
        return 'rate_limited';
      case 'unavailable':
      case 'unknown':
      default:
        return 'unavailable';
    }
  }

  private isRateLimitError(error: any): boolean {
    const message = error.message?.toLowerCase() || '';
    const responseData = error.response?.data?.error?.toLowerCase() || '';
    
    return (
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      responseData.includes('rate limit') ||
      responseData.includes('too many requests') ||
      error.response?.status === 429
    );
  }

  private isConnectionError(error: any): boolean {
    return (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ETIMEDOUT' ||
      error.message?.includes('Network Error') ||
      error.message?.includes('timeout')
    );
  }

  private getErrorMessage(error: any): string {
    if (error.response?.data?.error) {
      return error.response.data.error;
    }
    if (error.message) {
      return error.message;
    }
    return 'Unknown error occurred';
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}