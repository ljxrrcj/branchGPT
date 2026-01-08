import Anthropic from '@anthropic-ai/sdk';
import type { ILLMClient, LLMRequestConfig, LLMResponse, StreamChunk } from './ILLMClient';

/**
 * Custom error class for Anthropic-specific errors with enhanced context
 */
export class AnthropicError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly statusCode?: number,
    public readonly isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'AnthropicError';
  }
}

/**
 * Parse Anthropic errors and return a user-friendly error with context
 */
function parseAnthropicError(error: unknown): AnthropicError {
  if (error instanceof Anthropic.APIError) {
    const statusCode = error.status;

    switch (statusCode) {
      case 401:
        return new AnthropicError(
          'Invalid API key. Please check your Anthropic API key configuration.',
          'INVALID_API_KEY',
          401,
          false
        );
      case 403:
        return new AnthropicError(
          'Access denied. Your API key may not have permission for this operation.',
          'ACCESS_DENIED',
          403,
          false
        );
      case 429:
        return new AnthropicError(
          'Rate limit exceeded. Please wait before making more requests.',
          'RATE_LIMIT',
          429,
          true
        );
      case 500:
      case 502:
      case 503:
        return new AnthropicError(
          'Anthropic service is temporarily unavailable. Please try again later.',
          'SERVICE_UNAVAILABLE',
          statusCode,
          true
        );
      case 529:
        return new AnthropicError(
          'Anthropic API is overloaded. Please try again later.',
          'OVERLOADED',
          529,
          true
        );
      default:
        return new AnthropicError(
          `Anthropic API error: ${error.message}`,
          'API_ERROR',
          statusCode,
          (statusCode ?? 0) >= 500
        );
    }
  }

  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return new AnthropicError('Request was cancelled.', 'ABORTED', undefined, false);
    }
    if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
      return new AnthropicError(
        'Network error. Please check your internet connection.',
        'NETWORK_ERROR',
        undefined,
        true
      );
    }
    return new AnthropicError(`Unexpected error: ${error.message}`, 'UNKNOWN', undefined, false);
  }

  return new AnthropicError('An unknown error occurred.', 'UNKNOWN', undefined, false);
}

export class AnthropicClient implements ILLMClient {
  readonly provider = 'anthropic' as const;
  private client: Anthropic | null = null;
  private abortController: AbortController | null = null;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env['ANTHROPIC_API_KEY'];
    if (key) {
      this.client = new Anthropic({ apiKey: key });
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async complete(config: LLMRequestConfig): Promise<LLMResponse> {
    if (!this.client) {
      throw new AnthropicError(
        'Anthropic client not configured. Please provide an API key.',
        'NOT_CONFIGURED',
        undefined,
        false
      );
    }

    this.abortController = new AbortController();

    // Extract system message if present
    const systemMessage = config.messages.find((m) => m.role === 'system');
    const messages = config.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    try {
      const response = await this.client.messages.create(
        {
          model: config.model,
          max_tokens: config.maxTokens ?? 4096,
          ...(systemMessage?.content && { system: systemMessage.content }),
          messages,
        },
        { signal: this.abortController.signal }
      );

      const textBlock = response.content.find((block) => block.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        throw new AnthropicError(
          'No text content received from Anthropic. The model returned an empty response.',
          'EMPTY_RESPONSE',
          undefined,
          true
        );
      }

      return {
        content: textBlock.text,
        model: response.model,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
      };
    } catch (error) {
      if (error instanceof AnthropicError) {
        throw error;
      }
      throw parseAnthropicError(error);
    }
  }

  async *stream(config: LLMRequestConfig): AsyncGenerator<StreamChunk> {
    if (!this.client) {
      throw new AnthropicError(
        'Anthropic client not configured. Please provide an API key.',
        'NOT_CONFIGURED',
        undefined,
        false
      );
    }

    this.abortController = new AbortController();

    // Extract system message if present
    const systemMessage = config.messages.find((m) => m.role === 'system');
    const messages = config.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    let stream: AsyncIterable<Anthropic.MessageStreamEvent>;
    try {
      stream = await this.client.messages.create(
        {
          model: config.model,
          max_tokens: config.maxTokens ?? 4096,
          ...(systemMessage?.content && { system: systemMessage.content }),
          messages,
          stream: true,
        },
        { signal: this.abortController.signal }
      );
    } catch (error) {
      throw parseAnthropicError(error);
    }

    try {
      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          const delta = event.delta;
          if (delta.type === 'text_delta') {
            yield {
              content: delta.text,
              done: false,
            };
          }
        } else if (event.type === 'message_stop') {
          yield {
            content: '',
            done: true,
          };
          break;
        }
      }
    } catch (error) {
      if (error instanceof AnthropicError) {
        throw error;
      }
      throw parseAnthropicError(error);
    }
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}
