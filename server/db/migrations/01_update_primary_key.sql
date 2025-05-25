-- Update primary key to be composite (message_id, user_id)
DO $$ 
BEGIN
    -- First try to drop the existing PK constraint if it exists
    BEGIN
        ALTER TABLE read_events DROP CONSTRAINT read_events_pkey;
    EXCEPTION
        WHEN undefined_object THEN
            -- Primary key doesn't exist, that's fine
            RAISE NOTICE 'Primary key constraint does not exist';
    END;

    -- Create the table if it doesn't exist
    CREATE TABLE IF NOT EXISTS read_events (
        message_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        timestamp BIGINT NOT NULL
    );

    -- Add the new composite primary key
    ALTER TABLE read_events 
    ADD CONSTRAINT read_events_pkey 
    PRIMARY KEY (message_id, user_id);

    -- Ensure we have the indexes needed for performance
    CREATE INDEX IF NOT EXISTS idx_read_events_message_id ON read_events(message_id);
    CREATE INDEX IF NOT EXISTS idx_read_events_user_id ON read_events(user_id);

EXCEPTION
    WHEN duplicate_table THEN
        -- Table already exists, that's fine
        RAISE NOTICE 'Table read_events already exists';
    WHEN duplicate_object THEN
        -- Primary key already exists with correct definition
        RAISE NOTICE 'Primary key constraint already exists';
END $$;
