import { router } from '../trpc';
import { conversationRouter } from './conversation';
import { messageRouter } from './message';
import { llmRouter } from './llm';

export const appRouter = router({
  conversation: conversationRouter,
  message: messageRouter,
  llm: llmRouter,
});

export type AppRouter = typeof appRouter;
