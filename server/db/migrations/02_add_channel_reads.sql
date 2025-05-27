-- Add channel_reads table and related indices
DO $$ 
BEGIN
    -- Create the channel_reads table if it doesn't exist
    CREATE TABLE IF NOT EXISTS channel_reads (
        channel_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        last_post_id TEXT NOT NULL,
        last_seen_at BIGINT NOT NULL,
        PRIMARY KEY (channel_id, user_id)
    );

    -- Create indices for efficient querying
    CREATE INDEX IF NOT EXISTS idx_channel_reads_channel_id ON channel_reads(channel_id);
    CREATE INDEX IF NOT EXISTS idx_channel_reads_user_id ON channel_reads(user_id);
    CREATE INDEX IF NOT EXISTS idx_channel_reads_last_seen ON channel_reads(last_seen_at);

EXCEPTION
    WHEN duplicate_table THEN
        -- Table already exists, that's fine
        RAISE NOTICE 'channel_reads table already exists';
END $$;
