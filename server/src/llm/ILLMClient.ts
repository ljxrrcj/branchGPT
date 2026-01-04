/**
 * Unified interface for LLM providers
 */

export type LLMProvider = 'openai' | 'anthropic' | 'ollama';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequestConfig {
  model: string;
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface StreamChunk {
  content: string;
  done: boolean;
  model?: string;
}

/**
 * Abstract interface for LLM clients
 * All provider implementations must adhere to this interface
 */
export interface ILLMClient {
  readonly provider: LLMProvider;

  /**
   * Complete a chat request (non-streaming)
   */
  complete(config: LLMRequestConfig): Promise<LLMResponse>;

  /**
   * Stream a chat completion
   */
  stream(config: LLMRequestConfig): AsyncGenerator<StreamChunk>;

  /**
   * Abort the current request
   */
  abort(): void;

  /**
   * Check if the client is properly configured
   */
  isConfigured(): boolean;
}
