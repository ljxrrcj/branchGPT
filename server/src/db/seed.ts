import { closePool, withTransaction } from './client.js';
import type pg from 'pg';

async function seedDatabase(): Promise<void> {
  console.log('Starting database seed...');

  try {
    await withTransaction(async (client: pg.PoolClient) => {
      // Create a test user
      const userResult = await client.query<{ id: string }>(
        `INSERT INTO users (email)
         VALUES ($1)
         ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
         RETURNING id`,
        ['test@example.com']
      );
      const userId = userResult.rows[0]?.id;
      console.log('Created test user:', userId);

      // Create a sample conversation
      const convResult = await client.query<{ id: string }>(
        `INSERT INTO conversations (user_id, title)
         VALUES ($1, $2)
         RETURNING id`,
        [userId, 'Sample Conversation']
      );
      const conversationId = convResult.rows[0]?.id;
      console.log('Created sample conversation:', conversationId);

      // Create a root message
      const rootMsgResult = await client.query<{ id: string }>(
        `INSERT INTO messages (conversation_id, parent_id, path, role, content)
         VALUES ($1, NULL, $2::ltree, $3, $4)
         RETURNING id`,
        [
          conversationId,
          crypto.randomUUID().replace(/-/g, '_'),
          'user',
          'Hello! Can you help me understand how branching works in this chat?',
        ]
      );
      const rootMsgId = rootMsgResult.rows[0]?.id;
      console.log('Created root message:', rootMsgId);

      // Update conversation with root message
      await client.query(
        `UPDATE conversations SET root_message_id = $1 WHERE id = $2`,
        [rootMsgId, conversationId]
      );

      // Create assistant response
      const rootPath = rootMsgId?.replace(/-/g, '_');
      const assistantMsgId = crypto.randomUUID();
      const assistantPath = `${rootPath}.${assistantMsgId.replace(/-/g, '_')}`;

      await client.query(
        `INSERT INTO messages (id, conversation_id, parent_id, path, role, content, model)
         VALUES ($1, $2, $3, $4::ltree, $5, $6, $7)`,
        [
          assistantMsgId,
          conversationId,
          rootMsgId,
          assistantPath,
          'assistant',
          'Of course! Branching allows you to explore multiple conversation paths from the same point. When you ask multiple questions at once, the system can automatically create branches. You can also manually create branches by editing a message or regenerating a response.',
          'gpt-4o',
        ]
      );
      console.log('Created assistant response');

      // Create a default LLM config
      await client.query(
        `INSERT INTO llm_configs (user_id, provider, model, is_default)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [userId, 'openai', 'gpt-4o', true]
      );
      console.log('Created default LLM config');
    });

    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

seedDatabase().catch(console.error);
