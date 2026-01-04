-- branchGPT Database Indexes
-- Performance optimizations for common query patterns

-- Message tree queries using ltree
CREATE INDEX IF NOT EXISTS idx_messages_path
    ON messages USING GIST (path);

-- Messages by conversation (for loading conversation history)
CREATE INDEX IF NOT EXISTS idx_messages_conversation
    ON messages (conversation_id);

-- Messages by parent (for finding children/siblings)
CREATE INDEX IF NOT EXISTS idx_messages_parent
    ON messages (parent_id);

-- Messages by conversation and creation time (for ordered retrieval)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
    ON messages (conversation_id, created_at);

-- Conversations by user (for user's conversation list)
CREATE INDEX IF NOT EXISTS idx_conversations_user
    ON conversations (user_id);

-- Conversations by update time (for recent conversations)
CREATE INDEX IF NOT EXISTS idx_conversations_updated
    ON conversations (updated_at DESC);

-- Branches by conversation
CREATE INDEX IF NOT EXISTS idx_branches_conversation
    ON branches (conversation_id);

-- Branches by start message
CREATE INDEX IF NOT EXISTS idx_branches_start_message
    ON branches (start_message_id);

-- LLM configs by user
CREATE INDEX IF NOT EXISTS idx_llm_configs_user
    ON llm_configs (user_id);
