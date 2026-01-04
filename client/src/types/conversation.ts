export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageStatus = 'pending' | 'streaming' | 'completed' | 'error';
export type BranchSourceType = 'manual' | 'auto';
export type BranchSourceReason = 'edit' | 'regenerate' | 'multi_question';

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

export interface ConversationTree {
  conversation: Conversation;
  messages: Map<string, Message>;
  nodes: Map<string, BranchNode>;
  activePath: string[];
}
