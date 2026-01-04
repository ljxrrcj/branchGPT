export type LLMProvider = 'openai' | 'anthropic' | 'ollama';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMConfig {
  id: string;
  userId?: string;
  provider: LLMProvider;
  model: string;
  isDefault: boolean;
}

export interface LLMRequestConfig {
  provider: LLMProvider;
  model: string;
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface StreamChunk {
  content: string;
  done: boolean;
  model?: string;
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
