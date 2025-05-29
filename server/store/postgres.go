// File: server/config.go

package store

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/arg/mattermost-readreceipts/server/types"
)

type PostgresStore struct {
	BaseStore
}

func NewPostgresStore(db *sql.DB) *PostgresStore {
	return &PostgresStore{
		BaseStore: NewBaseStore(db),
	}
}

func (s *PostgresStore) Initialize() error {
	query := `
	CREATE TABLE IF NOT EXISTS read_events (
		message_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		timestamp BIGINT NOT NULL,
		channel_id TEXT,
		PRIMARY KEY (message_id, user_id)
	);
	CREATE INDEX IF NOT EXISTS idx_read_events_message_id ON read_events(message_id);
	CREATE INDEX IF NOT EXISTS idx_read_events_user_id ON read_events(user_id);
	CREATE INDEX IF NOT EXISTS idx_read_events_channel_id ON read_events(channel_id);
	`
	_, err := s.db.Exec(query)
	return err
}

func (s *PostgresStore) Upsert(event ReadEvent) error {
	query := `
		INSERT INTO read_events (message_id, user_id, timestamp, channel_id)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (message_id, user_id)
		DO UPDATE SET timestamp = EXCLUDED.timestamp, channel_id = EXCLUDED.channel_id
	`
	_, err := s.db.Exec(query, event.MessageID, event.UserID, event.Timestamp, event.ChannelID)
	return err
}

func (s *PostgresStore) GetByChannel(channelID, excludeUserID string) ([]ReadEvent, error) {
	query := `
		SELECT message_id, user_id, timestamp, channel_id
		FROM read_events re
		WHERE channel_id = $1
		AND ($2 = '' OR user_id != $2)
		ORDER BY timestamp DESC
	`

	rows, err := s.db.Query(query, channelID, excludeUserID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []ReadEvent
	for rows.Next() {
		var event ReadEvent
		if err := rows.Scan(&event.MessageID, &event.UserID, &event.Timestamp, &event.ChannelID); err != nil {
			return nil, err
		}
		events = append(events, event)
	}
	return events, rows.Err()
}

func (s *PostgresStore) CleanupOlderThan(days int) error {
	cutoffMs := time.Now().AddDate(0, 0, -days).UnixMilli()

	// PostgreSQL doesn't support multiple statements in a single Exec
	// Execute each DELETE separately
	if _, err := s.db.Exec("DELETE FROM read_events WHERE timestamp < $1", cutoffMs); err != nil {
		return err
	}

	if _, err := s.db.Exec("DELETE FROM channel_reads WHERE last_seen_at < $1", cutoffMs); err != nil {
		return err
	}

	return nil
}

func (s *PostgresStore) InitializeChannelReads() error {
	query := `
	CREATE TABLE IF NOT EXISTS channel_reads (
		channel_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		last_post_id TEXT NOT NULL,
		last_seen_at BIGINT NOT NULL,
		PRIMARY KEY (channel_id, user_id)
	);
	CREATE INDEX IF NOT EXISTS idx_channel_reads_channel_id ON channel_reads(channel_id);
	CREATE INDEX IF NOT EXISTS idx_channel_reads_user_id ON channel_reads(user_id);
	`
	_, err := s.db.Exec(query)
	return err
}

func (s *PostgresStore) UpsertChannelRead(channelID, userID, lastPostID string, lastSeenMs int64) error {
	query := `
	INSERT INTO channel_reads (channel_id, user_id, last_post_id, last_seen_at)
	VALUES ($1, $2, $3, $4)
	ON CONFLICT (channel_id, user_id)
	DO UPDATE SET last_post_id = EXCLUDED.last_post_id, last_seen_at = EXCLUDED.last_seen_at
	`
	_, err := s.db.Exec(query, channelID, userID, lastPostID, lastSeenMs)
	return err
}

// GetReadersSince returns a list of unique user IDs who have seen any post in the given channel
// since the specified time. It excludes a specific user (typically the requesting user).
//
// Parameters:
//   - channelID: The ID of the channel to check
//   - sinceMs: Unix timestamp in milliseconds - only include users who have seen posts since this time
//   - excludeUserID: User ID to exclude from the results
//
// Returns:
//   - []string: List of unique user IDs who have read posts in the channel since the given time
//   - error: Any database error that occurred
func (s *PostgresStore) GetReadersSince(channelID string, sinceMs int64, excludeUserID string) ([]string, error) {
	query := `
	SELECT user_id
	FROM channel_reads
	WHERE channel_id = $1 AND last_seen_at >= $2 AND user_id != $3
	`
	rows, err := s.db.Query(query, channelID, sinceMs, excludeUserID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var userIDs []string
	for rows.Next() {
		var userID string
		if err := rows.Scan(&userID); err != nil {
			return nil, err
		}
		userIDs = append(userIDs, userID)
	}
	return userIDs, rows.Err()
}

func (s *PostgresStore) BeginTx() (Tx, error) {
	return s.db.Begin()
}

func (s *PostgresStore) UpsertTx(tx Tx, event ReadEvent) error {
	sqlTx, ok := tx.(*sql.Tx)
	if !ok {
		return fmt.Errorf("invalid transaction type")
	}

	query := `
		INSERT INTO read_events (message_id, user_id, channel_id, timestamp)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (message_id, user_id) DO UPDATE SET
		timestamp = GREATEST(read_events.timestamp, EXCLUDED.timestamp),
		channel_id = EXCLUDED.channel_id
	`
	_, err := sqlTx.Exec(query, event.MessageID, event.UserID, event.ChannelID, event.Timestamp)
	return err
}

func (s *PostgresStore) UpsertChannelReadTx(tx Tx, read types.ChannelRead) error {
	sqlTx, ok := tx.(*sql.Tx)
	if !ok {
		return fmt.Errorf("invalid transaction type")
	}

	query := `
		INSERT INTO channel_reads (channel_id, user_id, last_post_id, last_seen_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (channel_id, user_id) DO UPDATE SET
		last_post_id = CASE
			WHEN channel_reads.last_seen_at < EXCLUDED.last_seen_at THEN EXCLUDED.last_post_id
			ELSE channel_reads.last_post_id
		END,
		last_seen_at = GREATEST(channel_reads.last_seen_at, EXCLUDED.last_seen_at)
	`
	_, err := sqlTx.Exec(query, read.ChannelID, read.UserID, read.LastPostID, read.LastSeenAt)
	return err
}

func (s *PostgresStore) GetChannelReads(channelID string) ([]types.ChannelRead, error) {
	query := `
		SELECT channel_id, user_id, last_post_id, last_seen_at
		FROM channel_reads
		WHERE channel_id = $1
		ORDER BY last_seen_at DESC
	`
	rows, err := s.db.Query(query, channelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reads []types.ChannelRead
	for rows.Next() {
		var read types.ChannelRead
		if err := rows.Scan(&read.ChannelID, &read.UserID, &read.LastPostID, &read.LastSeenAt); err != nil {
			return nil, err
		}
		reads = append(reads, read)
	}
	return reads, rows.Err()
}
