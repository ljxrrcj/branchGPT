import type { ILLMClient, LLMProvider, LLMRequestConfig, LLMResponse, StreamChunk } from './ILLMClient';
import { OpenAIClient } from './OpenAIClient';
import { AnthropicClient } from './AnthropicClient';
import { OllamaClient } from './OllamaClient';

/**
 * Manages LLM clients and provides a unified interface for chat completions
 */
export class LLMManager {
  private clients: Map<LLMProvider, ILLMClient> = new Map();
  private activeClient: ILLMClient | null = null;

  constructor() {
    // Initialize all clients
    this.clients.set('openai', new OpenAIClient());
    this.clients.set('anthropic', new AnthropicClient());
    this.clients.set('ollama', new OllamaClient());
  }

  /**
   * Get a client for a specific provider
   */
  getClient(provider: LLMProvider): ILLMClient {
    const client = this.clients.get(provider);
    if (!client) {
      throw new Error(`Unknown LLM provider: ${provider}`);
    }
    return client;
  }

  /**
   * Set a custom client for a provider (useful for testing or custom configurations)
   */
  setClient(provider: LLMProvider, client: ILLMClient): void {
    this.clients.set(provider, client);
  }

  /**
   * Check if a provider is configured
   */
  isProviderConfigured(provider: LLMProvider): boolean {
    const client = this.clients.get(provider);
    return client?.isConfigured() ?? false;
  }

  /**
   * Get all available providers and their configuration status
   */
  getAvailableProviders(): Array<{ provider: LLMProvider; isConfigured: boolean }> {
    const providers: LLMProvider[] = ['openai', 'anthropic', 'ollama'];
    return providers.map((provider) => ({
      provider,
      isConfigured: this.isProviderConfigured(provider),
    }));
  }

  /**
   * Complete a chat request using the specified provider
   */
  async complete(provider: LLMProvider, config: LLMRequestConfig): Promise<LLMResponse> {
    const client = this.getClient(provider);
    if (!client.isConfigured()) {
      throw new Error(`Provider ${provider} is not configured`);
    }
    this.activeClient = client;
    return client.complete(config);
  }

  /**
   * Stream a chat completion using the specified provider
   */
  async *stream(provider: LLMProvider, config: LLMRequestConfig): AsyncGenerator<StreamChunk> {
    const client = this.getClient(provider);
    if (!client.isConfigured()) {
      throw new Error(`Provider ${provider} is not configured`);
    }
    this.activeClient = client;
    yield* client.stream(config);
  }

  /**
   * Abort the current active request
   */
  abort(): void {
    if (this.activeClient) {
      this.activeClient.abort();
      this.activeClient = null;
    }
  }
}

// Export singleton instance
export const llmManager = new LLMManager();
