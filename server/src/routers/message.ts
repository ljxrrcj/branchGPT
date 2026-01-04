import { z } from 'zod';
import { router, publicProcedure } from '../trpc';

const messageRoleSchema = z.enum(['user', 'assistant', 'system']);
const messageStatusSchema = z.enum(['pending', 'streaming', 'completed', 'error']);

const messageSchema = z.object({
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

const branchSourceTypeSchema = z.enum(['manual', 'auto']);
const branchSourceReasonSchema = z.enum(['edit', 'regenerate', 'multi_question']);

export const messageRouter = router({
  /**
   * Send a new message in a conversation
   */
  send: publicProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
        parentId: z.string().uuid().nullable(),
        role: messageRoleSchema,
        content: z.string().min(1),
        model: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const now = new Date();
      const id = crypto.randomUUID();

      // TODO: Persist to database and trigger LLM response
      const message = {
        id,
        conversationId: input.conversationId,
        parentId: input.parentId,
        role: input.role,
        content: input.content,
        status: 'completed' as const,
        model: input.model,
        branchIndex: 0, // TODO: Calculate based on siblings
        createdAt: now,
      };

      return messageSchema.parse(message);
    }),

  /**
   * Get messages for a conversation
   */
  getByConversation: publicProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .query(async ({ input: _input }) => {
      // TODO: Fetch from database
      return [] as z.infer<typeof messageSchema>[];
    }),

  /**
   * Create a branch from an existing message
   */
  createBranch: publicProcedure
    .input(
      z.object({
        parentMessageId: z.string().uuid(),
        sourceType: branchSourceTypeSchema,
        sourceReason: branchSourceReasonSchema.optional(),
      })
    )
    .mutation(async ({ input }) => {
      const id = crypto.randomUUID();

      // TODO: Create branch record in database
      return {
        id,
        parentMessageId: input.parentMessageId,
        sourceType: input.sourceType,
        sourceReason: input.sourceReason ?? null,
        createdAt: new Date(),
      };
    }),

  /**
   * Update message content (for edits)
   */
  update: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      // TODO: Update in database
      return { id: input.id, content: input.content };
    }),

  /**
   * Delete a message (and its descendants)
   */
  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      // TODO: Delete from database using ltree path
      return { id: input.id, deleted: true };
    }),
});
