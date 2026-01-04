import Anthropic from '@anthropic-ai/sdk';
import type { ILLMClient, LLMRequestConfig, LLMResponse, StreamChunk } from './ILLMClient';

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
      throw new Error('Anthropic client not configured. Please provide an API key.');
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

    const response = await this.client.messages.create(
      {
        model: config.model,
        max_tokens: config.maxTokens ?? 4096,
        system: systemMessage?.content,
        messages,
      },
      { signal: this.abortController.signal }
    );

    const textBlock = response.content.find((block) => block.type === 'text');

    return {
      content: textBlock?.type === 'text' ? textBlock.text : '',
      model: response.model,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }

  async *stream(config: LLMRequestConfig): AsyncGenerator<StreamChunk> {
    if (!this.client) {
      throw new Error('Anthropic client not configured. Please provide an API key.');
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

    const stream = await this.client.messages.create(
      {
        model: config.model,
        max_tokens: config.maxTokens ?? 4096,
        system: systemMessage?.content,
        messages,
        stream: true,
      },
      { signal: this.abortController.signal }
    );

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
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}
