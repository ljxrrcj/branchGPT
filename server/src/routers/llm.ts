import { z } from 'zod';
import { router, publicProcedure } from '../trpc';

const llmProviderSchema = z.enum(['openai', 'anthropic', 'ollama']);

const llmConfigSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().optional(),
  provider: llmProviderSchema,
  model: z.string(),
  isDefault: z.boolean(),
});

const providerModels = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-opus-latest'],
  ollama: ['llama3.2', 'mistral', 'codellama'],
} as const;

export const llmRouter = router({
  /**
   * List available LLM providers and their models
   */
  listProviders: publicProcedure.query(() => {
    return Object.entries(providerModels).map(([provider, models]) => ({
      provider,
      models: [...models],
      isConfigured: false, // TODO: Check if API key is configured
    }));
  }),

  /**
   * Get user's LLM configuration
   */
  getConfig: publicProcedure
    .input(z.object({ userId: z.string().uuid().optional() }))
    .query(async ({ input: _input }) => {
      // TODO: Fetch from database
      // Return default config for now
      return {
        id: crypto.randomUUID(),
        provider: 'openai' as const,
        model: 'gpt-4o',
        isDefault: true,
      };
    }),

  /**
   * Update LLM configuration
   */
  updateConfig: publicProcedure
    .input(
      z.object({
        userId: z.string().uuid().optional(),
        provider: llmProviderSchema,
        model: z.string(),
        apiKey: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const id = crypto.randomUUID();

      // TODO: Encrypt and store API key, save config to database
      const config = {
        id,
        userId: input.userId,
        provider: input.provider,
        model: input.model,
        isDefault: true,
      };

      return llmConfigSchema.parse(config);
    }),

  /**
   * Test LLM connection with current config
   */
  testConnection: publicProcedure
    .input(
      z.object({
        provider: llmProviderSchema,
        model: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      // TODO: Make a test request to the LLM provider
      return {
        success: true,
        provider: input.provider,
        model: input.model,
        message: 'Connection test not yet implemented',
      };
    }),
});
