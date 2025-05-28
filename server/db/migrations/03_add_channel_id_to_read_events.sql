-- Migration: Add channel_id column to read_events (PostgreSQL)
DO $$
BEGIN
    -- Add the channel_id column if it does not exist
    BEGIN
        ALTER TABLE read_events ADD COLUMN channel_id TEXT;
    EXCEPTION
        WHEN duplicate_column THEN
            RAISE NOTICE 'channel_id column already exists in read_events';
    END;

    -- Optionally backfill channel_id from message_id if possible
    UPDATE read_events SET channel_id = split_part(message_id, ':', 1)
    WHERE channel_id IS NULL OR channel_id = '';
END $$;
