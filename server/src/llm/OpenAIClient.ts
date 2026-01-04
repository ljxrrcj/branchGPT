import OpenAI from 'openai';
import type { ILLMClient, LLMRequestConfig, LLMResponse, StreamChunk } from './ILLMClient';

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
      throw new Error('OpenAI client not configured. Please provide an API key.');
    }

    this.abortController = new AbortController();

    const response = await this.client.chat.completions.create(
      {
        model: config.model,
        messages: config.messages,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
      },
      { signal: this.abortController.signal }
    );

    const choice = response.choices[0];
    if (!choice) {
      throw new Error('No response from OpenAI');
    }

    return {
      content: choice.message.content ?? '',
      model: response.model,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  }

  async *stream(config: LLMRequestConfig): AsyncGenerator<StreamChunk> {
    if (!this.client) {
      throw new Error('OpenAI client not configured. Please provide an API key.');
    }

    this.abortController = new AbortController();

    const stream = await this.client.chat.completions.create(
      {
        model: config.model,
        messages: config.messages,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        stream: true,
      },
      { signal: this.abortController.signal }
    );

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
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}
