/**
 * Placeholder for AppRouter type
 * This will be properly exported from the server package
 * For now, we define a minimal type to satisfy the client
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppRouter = any;

// Core domain types shared between client and server

export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageStatus = 'pending' | 'streaming' | 'completed' | 'error';
export type BranchSourceType = 'manual' | 'auto';
export type BranchSourceReason = 'edit' | 'regenerate' | 'multi_question';
export type ViewMode = 'chat' | 'branch' | 'overview';
export type ZoomPhase = 'snap' | 'free';
export type LLMProvider = 'openai' | 'anthropic' | 'ollama';

export interface Message {
  id: string;
  conversationId: string;
  parentId: string | null;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  model?: string;
  branchIndex: number;
  createdAt: Date;
}

export interface BranchNode {
  id: string;
  messageId: string;
  parentId: string | null;
  children: string[];
  depth: number;
  isActive: boolean;
}

export interface Branch {
  id: string;
  conversationId: string;
  startMessageId: string;
  sourceType: BranchSourceType;
  sourceReason?: BranchSourceReason;
  createdAt: Date;
}

export interface Conversation {
  id: string;
  userId?: string;
  title: string | null;
  rootMessageId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
  zoomPhase: ZoomPhase;
}

export interface ViewState {
  mode: ViewMode;
  viewport: Viewport;
  isInputVisible: boolean;
  focusRatio: number;
  selectedNodeId: string | null;
}

export interface LLMConfig {
  id: string;
  userId?: string;
  provider: LLMProvider;
  model: string;
  isDefault: boolean;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamChunk {
  content: string;
  done: boolean;
  model?: string;
}
