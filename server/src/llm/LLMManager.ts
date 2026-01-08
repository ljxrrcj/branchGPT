import type { ILLMClient, LLMProvider, LLMRequestConfig, LLMResponse, StreamChunk } from './ILLMClient';
import { OpenAIClient, OpenAIError } from './OpenAIClient';
import { AnthropicClient, AnthropicError } from './AnthropicClient';
import { OllamaClient, OllamaError } from './OllamaClient';

/**
 * Custom error class for LLM Manager errors with enhanced context
 */
export class LLMManagerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly provider?: LLMProvider,
    public readonly originalError?: Error,
    public readonly isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'LLMManagerError';
  }
}

/**
 * Wrap provider-specific errors with LLMManager context
 */
function wrapProviderError(error: unknown, provider: LLMProvider): LLMManagerError {
  if (error instanceof LLMManagerError) {
    return error;
  }

  // Handle provider-specific errors
  if (error instanceof OpenAIError || error instanceof AnthropicError || error instanceof OllamaError) {
    return new LLMManagerError(
      `[${provider}] ${error.message}`,
      error.code ?? 'PROVIDER_ERROR',
      provider,
      error,
      error.isRetryable
    );
  }

  // Handle generic errors
  if (error instanceof Error) {
    return new LLMManagerError(
      `[${provider}] Unexpected error: ${error.message}`,
      'UNEXPECTED_ERROR',
      provider,
      error,
      false
    );
  }

  return new LLMManagerError(
    `[${provider}] An unknown error occurred`,
    'UNKNOWN_ERROR',
    provider,
    undefined,
    false
  );
}

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
   * @throws {LLMManagerError} If the provider is unknown
   */
  getClient(provider: LLMProvider): ILLMClient {
    const client = this.clients.get(provider);
    if (!client) {
      throw new LLMManagerError(
        `Unknown LLM provider: "${provider}". Available providers: openai, anthropic, ollama.`,
        'UNKNOWN_PROVIDER',
        provider,
        undefined,
        false
      );
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
   * @throws {LLMManagerError} If the provider is not configured or the request fails
   */
  async complete(provider: LLMProvider, config: LLMRequestConfig): Promise<LLMResponse> {
    const client = this.getClient(provider);
    if (!client.isConfigured()) {
      throw new LLMManagerError(
        `Provider "${provider}" is not configured. Please provide the required API key or configuration.`,
        'PROVIDER_NOT_CONFIGURED',
        provider,
        undefined,
        false
      );
    }

    this.activeClient = client;

    try {
      return await client.complete(config);
    } catch (error) {
      throw wrapProviderError(error, provider);
    }
  }

  /**
   * Stream a chat completion using the specified provider
   * @throws {LLMManagerError} If the provider is not configured or the request fails
   */
  async *stream(provider: LLMProvider, config: LLMRequestConfig): AsyncGenerator<StreamChunk> {
    const client = this.getClient(provider);
    if (!client.isConfigured()) {
      throw new LLMManagerError(
        `Provider "${provider}" is not configured. Please provide the required API key or configuration.`,
        'PROVIDER_NOT_CONFIGURED',
        provider,
        undefined,
        false
      );
    }

    this.activeClient = client;

    try {
      yield* client.stream(config);
    } catch (error) {
      throw wrapProviderError(error, provider);
    }
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

// Re-export error types for consumers
export { OpenAIError, AnthropicError, OllamaError };
