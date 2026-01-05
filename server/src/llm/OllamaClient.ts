import type { ILLMClient, LLMRequestConfig, LLMResponse, StreamChunk } from './ILLMClient';

interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaErrorResponse {
  error?: string;
}

/**
 * Custom error class for Ollama-specific errors with enhanced context
 */
export class OllamaError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly statusCode?: number,
    public readonly isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'OllamaError';
  }
}

/**
 * Parse Ollama errors and return a user-friendly error with context
 */
function parseOllamaError(error: unknown, statusCode?: number): OllamaError {
  if (error instanceof OllamaError) {
    return error;
  }

  if (error instanceof TypeError && error.message.includes('fetch')) {
    return new OllamaError(
      'Cannot connect to Ollama. Make sure Ollama is running on your machine.',
      'CONNECTION_FAILED',
      undefined,
      true
    );
  }

  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return new OllamaError('Request was cancelled.', 'ABORTED', undefined, false);
    }
    if (error.message.includes('ECONNREFUSED')) {
      return new OllamaError(
        'Cannot connect to Ollama. Make sure Ollama is running on your machine.',
        'CONNECTION_REFUSED',
        undefined,
        true
      );
    }
    if (error.message.includes('network') || error.message.includes('Failed to fetch')) {
      return new OllamaError(
        'Network error connecting to Ollama. Please check your connection.',
        'NETWORK_ERROR',
        undefined,
        true
      );
    }
    return new OllamaError(`Ollama error: ${error.message}`, 'UNKNOWN', statusCode, false);
  }

  return new OllamaError('An unknown error occurred with Ollama.', 'UNKNOWN', statusCode, false);
}

/**
 * Parse HTTP status code to user-friendly error
 */
function parseStatusCodeError(statusCode: number, statusText: string, errorBody?: string): OllamaError {
  switch (statusCode) {
    case 404:
      return new OllamaError(
        `Model not found. Please make sure the model is pulled: ${errorBody ?? statusText}`,
        'MODEL_NOT_FOUND',
        404,
        false
      );
    case 500:
      return new OllamaError(
        `Ollama server error: ${errorBody ?? statusText}`,
        'SERVER_ERROR',
        500,
        true
      );
    case 503:
      return new OllamaError(
        'Ollama service is temporarily unavailable. It may be loading a model.',
        'SERVICE_UNAVAILABLE',
        503,
        true
      );
    default:
      return new OllamaError(
        `Ollama request failed (${statusCode}): ${errorBody ?? statusText}`,
        'REQUEST_FAILED',
        statusCode,
        statusCode >= 500
      );
  }
}

/**
 * Validate Ollama response structure
 */
function validateOllamaResponse(data: unknown): data is OllamaResponse {
  if (!data || typeof data !== 'object') return false;
  const response = data as Record<string, unknown>;
  return (
    typeof response['model'] === 'string' &&
    typeof response['done'] === 'boolean' &&
    response['message'] !== undefined &&
    typeof (response['message'] as Record<string, unknown>)['content'] === 'string'
  );
}

export class OllamaClient implements ILLMClient {
  readonly provider = 'ollama' as const;
  private baseUrl: string;
  private abortController: AbortController | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? process.env['OLLAMA_BASE_URL'] ?? 'http://localhost:11434';
  }

  isConfigured(): boolean {
    return true; // Ollama doesn't require API key
  }

  async complete(config: LLMRequestConfig): Promise<LLMResponse> {
    this.abortController = new AbortController();

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          messages: config.messages,
          stream: false,
          options: {
            temperature: config.temperature,
            num_predict: config.maxTokens,
          },
        }),
        signal: this.abortController.signal,
      });
    } catch (error) {
      throw parseOllamaError(error);
    }

    if (!response.ok) {
      let errorBody: string | undefined;
      try {
        const errorJson = (await response.json()) as OllamaErrorResponse;
        errorBody = errorJson.error;
      } catch {
        // Ignore JSON parsing errors for error response
      }
      throw parseStatusCodeError(response.status, response.statusText, errorBody);
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch (error) {
      throw new OllamaError(
        'Failed to parse Ollama response. The server returned invalid JSON.',
        'INVALID_RESPONSE',
        undefined,
        true
      );
    }

    if (!validateOllamaResponse(data)) {
      throw new OllamaError(
        'Invalid response structure from Ollama. The response is missing required fields.',
        'INVALID_RESPONSE',
        undefined,
        true
      );
    }

    const result: LLMResponse = {
      content: data.message.content,
      model: data.model,
    };

    if (data.prompt_eval_count !== undefined && data.eval_count !== undefined) {
      result.usage = {
        promptTokens: data.prompt_eval_count,
        completionTokens: data.eval_count,
        totalTokens: data.prompt_eval_count + data.eval_count,
      };
    }

    return result;
  }

  async *stream(config: LLMRequestConfig): AsyncGenerator<StreamChunk> {
    this.abortController = new AbortController();

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          messages: config.messages,
          stream: true,
          options: {
            temperature: config.temperature,
            num_predict: config.maxTokens,
          },
        }),
        signal: this.abortController.signal,
      });
    } catch (error) {
      throw parseOllamaError(error);
    }

    if (!response.ok) {
      let errorBody: string | undefined;
      try {
        const errorJson = (await response.json()) as OllamaErrorResponse;
        errorBody = errorJson.error;
      } catch {
        // Ignore JSON parsing errors for error response
      }
      throw parseStatusCodeError(response.status, response.statusText, errorBody);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new OllamaError(
        'No response body received from Ollama.',
        'NO_RESPONSE_BODY',
        undefined,
        true
      );
    }

    const decoder = new TextDecoder();
    let invalidLineCount = 0;
    const maxInvalidLines = 10;

    try {
      while (true) {
        let readResult: { done: boolean; value?: Uint8Array };
        try {
          readResult = await reader.read();
        } catch (error) {
          throw parseOllamaError(error);
        }

        const { done, value } = readResult;
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line) as unknown;
            if (!validateOllamaResponse(data)) {
              invalidLineCount++;
              if (invalidLineCount >= maxInvalidLines) {
                throw new OllamaError(
                  'Too many invalid responses from Ollama stream.',
                  'STREAM_CORRUPTED',
                  undefined,
                  true
                );
              }
              continue;
            }

            yield {
              content: data.message.content,
              done: data.done,
              model: data.model,
            };

            if (data.done) return;
          } catch (parseError) {
            if (parseError instanceof OllamaError) {
              throw parseError;
            }
            // JSON parse error - skip this line but track count
            invalidLineCount++;
            if (invalidLineCount >= maxInvalidLines) {
              throw new OllamaError(
                'Too many JSON parsing errors in Ollama stream. The response may be corrupted.',
                'STREAM_PARSE_ERROR',
                undefined,
                true
              );
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}
