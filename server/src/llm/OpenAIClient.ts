import OpenAI from 'openai';
import type { ILLMClient, LLMRequestConfig, LLMResponse, StreamChunk } from './ILLMClient';

/**
 * Custom error class for OpenAI-specific errors with enhanced context
 */
export class OpenAIError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly statusCode?: number,
    public readonly isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'OpenAIError';
  }
}

/**
 * Parse OpenAI errors and return a user-friendly error with context
 */
function parseOpenAIError(error: unknown): OpenAIError {
  if (error instanceof OpenAI.APIError) {
    const statusCode = error.status;

    switch (statusCode) {
      case 401:
        return new OpenAIError(
          'Invalid API key. Please check your OpenAI API key configuration.',
          'INVALID_API_KEY',
          401,
          false
        );
      case 403:
        return new OpenAIError(
          'Access denied. Your API key may not have permission for this operation.',
          'ACCESS_DENIED',
          403,
          false
        );
      case 429:
        return new OpenAIError(
          'Rate limit exceeded. Please wait before making more requests.',
          'RATE_LIMIT',
          429,
          true
        );
      case 500:
      case 502:
      case 503:
        return new OpenAIError(
          'OpenAI service is temporarily unavailable. Please try again later.',
          'SERVICE_UNAVAILABLE',
          statusCode,
          true
        );
      case 504:
        return new OpenAIError(
          'Request timed out. The server took too long to respond.',
          'TIMEOUT',
          504,
          true
        );
      default:
        return new OpenAIError(
          `OpenAI API error: ${error.message}`,
          'API_ERROR',
          statusCode,
          statusCode >= 500
        );
    }
  }

  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return new OpenAIError('Request was cancelled.', 'ABORTED', undefined, false);
    }
    if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
      return new OpenAIError(
        'Network error. Please check your internet connection.',
        'NETWORK_ERROR',
        undefined,
        true
      );
    }
    return new OpenAIError(`Unexpected error: ${error.message}`, 'UNKNOWN', undefined, false);
  }

  return new OpenAIError('An unknown error occurred.', 'UNKNOWN', undefined, false);
}

export class OpenAIClient implements ILLMClient {
  readonly provider = 'openai' as const;
  private client: OpenAI | null = null;
  private abortController: AbortController | null = null;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env['OPENAI_API_KEY'];
    if (key) {
      this.client = new OpenAI({ apiKey: key });
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async complete(config: LLMRequestConfig): Promise<LLMResponse> {
    if (!this.client) {
      throw new OpenAIError(
        'OpenAI client not configured. Please provide an API key.',
        'NOT_CONFIGURED',
        undefined,
        false
      );
    }

    this.abortController = new AbortController();

    try {
      const response = await this.client.chat.completions.create(
        {
          model: config.model,
          messages: config.messages,
          ...(config.maxTokens !== undefined && { max_tokens: config.maxTokens }),
          ...(config.temperature !== undefined && { temperature: config.temperature }),
        },
        { signal: this.abortController.signal }
      );

      const choice = response.choices[0];
      if (!choice) {
        throw new OpenAIError(
          'No response received from OpenAI. The model returned an empty response.',
          'EMPTY_RESPONSE',
          undefined,
          true
        );
      }

      const result: LLMResponse = {
        content: choice.message.content ?? '',
        model: response.model,
      };

      if (response.usage) {
        result.usage = {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        };
      }

      return result;
    } catch (error) {
      if (error instanceof OpenAIError) {
        throw error;
      }
      throw parseOpenAIError(error);
    }
  }

  async *stream(config: LLMRequestConfig): AsyncGenerator<StreamChunk> {
    if (!this.client) {
      throw new OpenAIError(
        'OpenAI client not configured. Please provide an API key.',
        'NOT_CONFIGURED',
        undefined,
        false
      );
    }

    this.abortController = new AbortController();

    let stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
    try {
      stream = await this.client.chat.completions.create(
        {
          model: config.model,
          messages: config.messages,
          ...(config.maxTokens !== undefined && { max_tokens: config.maxTokens }),
          ...(config.temperature !== undefined && { temperature: config.temperature }),
          stream: true,
        },
        { signal: this.abortController.signal }
      );
    } catch (error) {
      throw parseOpenAIError(error);
    }

    try {
      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        const content = choice?.delta.content ?? '';
        const done = choice?.finish_reason !== null;

        yield {
          content,
          done,
          model: chunk.model,
        };

        if (done) break;
      }
    } catch (error) {
      if (error instanceof OpenAIError) {
        throw error;
      }
      throw parseOpenAIError(error);
    }
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}
