import { z } from 'zod';

// Message schemas
export const messageRoleSchema = z.enum(['user', 'assistant', 'system']);
export const messageStatusSchema = z.enum(['pending', 'streaming', 'completed', 'error']);

export const messageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  role: messageRoleSchema,
  content: z.string(),
  status: messageStatusSchema,
  model: z.string().optional(),
  branchIndex: z.number().int().min(0),
  createdAt: z.date(),
});

// Branch schemas
export const branchSourceTypeSchema = z.enum(['manual', 'auto']);
export const branchSourceReasonSchema = z.enum(['edit', 'regenerate', 'multi_question']);

export const branchSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  startMessageId: z.string().uuid(),
  sourceType: branchSourceTypeSchema,
  sourceReason: branchSourceReasonSchema.optional(),
  createdAt: z.date(),
});

// Conversation schemas
export const conversationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().optional(),
  title: z.string().nullable(),
  rootMessageId: z.string().uuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// View schemas
export const viewModeSchema = z.enum(['chat', 'branch', 'overview']);
export const zoomPhaseSchema = z.enum(['snap', 'free']);

export const viewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number().min(0.1).max(2),
  zoomPhase: zoomPhaseSchema,
});

// LLM schemas
export const llmProviderSchema = z.enum(['openai', 'anthropic', 'ollama']);

export const llmConfigSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().optional(),
  provider: llmProviderSchema,
  model: z.string(),
  isDefault: z.boolean(),
});

export const llmMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});

// Inferred types from schemas
export type MessageSchemaType = z.infer<typeof messageSchema>;
export type BranchSchemaType = z.infer<typeof branchSchema>;
export type ConversationSchemaType = z.infer<typeof conversationSchema>;
export type ViewportSchemaType = z.infer<typeof viewportSchema>;
export type LLMConfigSchemaType = z.infer<typeof llmConfigSchema>;
export type LLMMessageSchemaType = z.infer<typeof llmMessageSchema>;
