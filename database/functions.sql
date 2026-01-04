-- branchGPT Database Functions
-- Helper functions for tree operations

-- Generate ltree path for a new message
CREATE OR REPLACE FUNCTION generate_message_path(
    p_parent_id UUID,
    p_message_id UUID
) RETURNS LTREE AS $$
DECLARE
    parent_path LTREE;
    new_path LTREE;
BEGIN
    IF p_parent_id IS NULL THEN
        -- Root message: path is just the message ID (with underscores replacing hyphens)
        new_path := REPLACE(p_message_id::TEXT, '-', '_')::LTREE;
    ELSE
        -- Get parent's path
        SELECT path INTO parent_path FROM messages WHERE id = p_parent_id;

        IF parent_path IS NULL THEN
            RAISE EXCEPTION 'Parent message not found: %', p_parent_id;
        END IF;

        -- Append this message's ID to parent's path
        new_path := parent_path || REPLACE(p_message_id::TEXT, '-', '_')::LTREE;
    END IF;

    RETURN new_path;
END;
$$ LANGUAGE plpgsql;

-- Get all ancestors of a message (path from root to this message)
CREATE OR REPLACE FUNCTION get_message_ancestors(p_message_id UUID)
RETURNS TABLE (
    id UUID,
    conversation_id UUID,
    parent_id UUID,
    role VARCHAR(20),
    content TEXT,
    status VARCHAR(20),
    model VARCHAR(100),
    branch_index INTEGER,
    created_at TIMESTAMPTZ,
    depth INTEGER
) AS $$
DECLARE
    message_path LTREE;
BEGIN
    -- Get the path of the target message
    SELECT m.path INTO message_path FROM messages m WHERE m.id = p_message_id;

    IF message_path IS NULL THEN
        RETURN;
    END IF;

    -- Return all ancestors including self, ordered by depth
    RETURN QUERY
    SELECT
        m.id,
        m.conversation_id,
        m.parent_id,
        m.role,
        m.content,
        m.status,
        m.model,
        m.branch_index,
        m.created_at,
        nlevel(m.path) as depth
    FROM messages m
    WHERE m.path @> message_path OR m.path <@ message_path
    ORDER BY nlevel(m.path);
END;
$$ LANGUAGE plpgsql;

-- Get all descendants of a message
CREATE OR REPLACE FUNCTION get_message_descendants(p_message_id UUID)
RETURNS TABLE (
    id UUID,
    conversation_id UUID,
    parent_id UUID,
    role VARCHAR(20),
    content TEXT,
    status VARCHAR(20),
    model VARCHAR(100),
    branch_index INTEGER,
    created_at TIMESTAMPTZ,
    depth INTEGER
) AS $$
DECLARE
    message_path LTREE;
BEGIN
    -- Get the path of the target message
    SELECT m.path INTO message_path FROM messages m WHERE m.id = p_message_id;

    IF message_path IS NULL THEN
        RETURN;
    END IF;

    -- Return all descendants
    RETURN QUERY
    SELECT
        m.id,
        m.conversation_id,
        m.parent_id,
        m.role,
        m.content,
        m.status,
        m.model,
        m.branch_index,
        m.created_at,
        nlevel(m.path) as depth
    FROM messages m
    WHERE m.path <@ message_path AND m.id != p_message_id
    ORDER BY nlevel(m.path), m.created_at;
END;
$$ LANGUAGE plpgsql;

-- Get direct children of a message
CREATE OR REPLACE FUNCTION get_message_children(p_message_id UUID)
RETURNS TABLE (
    id UUID,
    conversation_id UUID,
    parent_id UUID,
    role VARCHAR(20),
    content TEXT,
    status VARCHAR(20),
    model VARCHAR(100),
    branch_index INTEGER,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id,
        m.conversation_id,
        m.parent_id,
        m.role,
        m.content,
        m.status,
        m.model,
        m.branch_index,
        m.created_at
    FROM messages m
    WHERE m.parent_id = p_message_id
    ORDER BY m.branch_index, m.created_at;
END;
$$ LANGUAGE plpgsql;

-- Count branches (children) at a message
CREATE OR REPLACE FUNCTION count_message_branches(p_message_id UUID)
RETURNS INTEGER AS $$
DECLARE
    branch_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO branch_count
    FROM messages
    WHERE parent_id = p_message_id;

    RETURN branch_count;
END;
$$ LANGUAGE plpgsql;

-- Get the full conversation tree as a JSON structure
CREATE OR REPLACE FUNCTION get_conversation_tree(p_conversation_id UUID)
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT json_agg(row_to_json(m))
        FROM (
            SELECT
                m.id,
                m.conversation_id,
                m.parent_id,
                m.role,
                m.content,
                m.status,
                m.model,
                m.branch_index,
                m.created_at,
                nlevel(m.path) as depth
            FROM messages m
            WHERE m.conversation_id = p_conversation_id
            ORDER BY m.path
        ) m
    );
END;
$$ LANGUAGE plpgsql;
