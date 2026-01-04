import { z } from 'zod';
import { router, publicProcedure } from '../trpc';

const conversationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().optional(),
  title: z.string().nullable(),
  rootMessageId: z.string().uuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const conversationRouter = router({
  /**
   * Create a new conversation
   */
  create: publicProcedure
    .input(
      z.object({
        title: z.string().optional(),
        userId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const now = new Date();
      const id = crypto.randomUUID();

      // TODO: Persist to database
      const conversation = {
        id,
        userId: input.userId ?? null,
        title: input.title ?? null,
        rootMessageId: null,
        createdAt: now,
        updatedAt: now,
      };

      return conversationSchema.parse(conversation);
    }),

  /**
   * List all conversations for a user
   */
  list: publicProcedure
    .input(
      z.object({
        userId: z.string().uuid().optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().uuid().optional(),
      })
    )
    .query(async ({ input: _input }) => {
      // TODO: Fetch from database
      return {
        conversations: [] as z.infer<typeof conversationSchema>[],
        nextCursor: null as string | null,
      };
    }),

  /**
   * Get a conversation with its full message tree
   */
  getTree: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input: _input }) => {
      // TODO: Fetch from database with ltree path
      return null;
    }),

  /**
   * Update conversation title
   */
  updateTitle: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      // TODO: Update in database
      return { id: input.id, title: input.title };
    }),

  /**
   * Delete a conversation
   */
  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      // TODO: Delete from database (cascade to messages)
      return { id: input.id, deleted: true };
    }),
});
