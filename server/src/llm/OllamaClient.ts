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

    const response = await fetch(`${this.baseUrl}/api/chat`, {
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

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    const data = (await response.json()) as OllamaResponse;

    return {
      content: data.message.content,
      model: data.model,
      usage: data.prompt_eval_count !== undefined && data.eval_count !== undefined
        ? {
            promptTokens: data.prompt_eval_count,
            completionTokens: data.eval_count,
            totalTokens: data.prompt_eval_count + data.eval_count,
          }
        : undefined,
    };
  }

  async *stream(config: LLMRequestConfig): AsyncGenerator<StreamChunk> {
    this.abortController = new AbortController();

    const response = await fetch(`${this.baseUrl}/api/chat`, {
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

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line) as OllamaResponse;
            yield {
              content: data.message.content,
              done: data.done,
              model: data.model,
            };

            if (data.done) break;
          } catch {
            // Skip invalid JSON lines
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
