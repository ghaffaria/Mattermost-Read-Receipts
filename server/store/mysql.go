// File: server/config.go

package store

import (
	"database/sql"
	"fmt"
	"time"
)

type MySQLStore struct {
	BaseStore
}

func NewMySQLStore(db *sql.DB) *MySQLStore {
	return &MySQLStore{
		BaseStore: NewBaseStore(db),
	}
}

func (s *MySQLStore) Initialize() error {
	// Create table if not exists
	createTable := `
	CREATE TABLE IF NOT EXISTS read_events (
		message_id VARCHAR(255) NOT NULL,
		user_id VARCHAR(255) NOT NULL,
		timestamp BIGINT NOT NULL,
		PRIMARY KEY (message_id, user_id)
	)
	`
	if _, err := s.db.Exec(createTable); err != nil {
		return err
	}

	// Create indices if they don't exist (MySQL-safe way)
	indices := []string{
		"CREATE INDEX idx_read_events_message_id ON read_events(message_id)",
		"CREATE INDEX idx_read_events_user_id ON read_events(user_id)",
	}

	for _, idx := range indices {
		// Ignore errors as they likely mean the index already exists
		s.db.Exec(idx)
	}

	return nil
}

func (s *MySQLStore) Upsert(event ReadEvent) error {
	query := `
		INSERT INTO read_events (message_id, user_id, timestamp)
		VALUES (?, ?, ?)
		ON DUPLICATE KEY UPDATE timestamp = VALUES(timestamp)
	`
	_, err := s.db.Exec(query, event.MessageID, event.UserID, event.Timestamp)
	return err
}

func (s *MySQLStore) GetByChannel(channelID, excludeUserID string) ([]ReadEvent, error) {
	query := `
		SELECT message_id, user_id, timestamp
		FROM read_events re
		WHERE message_id LIKE ?
		AND user_id != ?
		ORDER BY timestamp DESC
	`
	// Use channel ID prefix to match messages in the channel
	channelPrefix := channelID + ":%"

	rows, err := s.db.Query(query, channelPrefix, excludeUserID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []ReadEvent
	for rows.Next() {
		var event ReadEvent
		if err := rows.Scan(&event.MessageID, &event.UserID, &event.Timestamp); err != nil {
			return nil, err
		}
		events = append(events, event)
	}
	return events, rows.Err()
}

func (s *MySQLStore) CleanupOlderThan(days int) error {
	cutoffMs := time.Now().AddDate(0, 0, -days).UnixMilli()

	// Execute each DELETE separately to avoid requiring multiStatements=true
	if _, err := s.db.Exec("DELETE FROM read_events WHERE timestamp < ?", cutoffMs); err != nil {
		return fmt.Errorf("failed to cleanup read_events: %w", err)
	}

	if _, err := s.db.Exec("DELETE FROM channel_reads WHERE last_seen_at < ?", cutoffMs); err != nil {
		return fmt.Errorf("failed to cleanup channel_reads: %w", err)
	}

	return nil
}

func (s *MySQLStore) InitializeChannelReads() error {
	query := `
	CREATE TABLE IF NOT EXISTS channel_reads (
		channel_id VARCHAR(255) NOT NULL,
		user_id VARCHAR(255) NOT NULL,
		last_post_id VARCHAR(255) NOT NULL,
		last_seen_at BIGINT NOT NULL,
		PRIMARY KEY (channel_id, user_id)
	)`
	if _, err := s.db.Exec(query); err != nil {
		return err
	}

	// Create indices
	indices := []string{
		"CREATE INDEX idx_channel_reads_channel_id ON channel_reads(channel_id)",
		"CREATE INDEX idx_channel_reads_user_id ON channel_reads(user_id)",
	}

	for _, idx := range indices {
		// Ignore errors as they likely mean the index already exists
		s.db.Exec(idx)
	}

	return nil
}

func (s *MySQLStore) UpsertChannelRead(channelID, userID, lastPostID string, lastSeenMs int64) error {
	query := `
	INSERT INTO channel_reads (channel_id, user_id, last_post_id, last_seen_at)
	VALUES (?, ?, ?, ?)
	ON DUPLICATE KEY UPDATE last_post_id = VALUES(last_post_id), last_seen_at = VALUES(last_seen_at)
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
func (s *MySQLStore) GetReadersSince(channelID string, sinceMs int64, excludeUserID string) ([]string, error) {
	query := `
	SELECT user_id
	FROM channel_reads
	WHERE channel_id = ? AND last_seen_at >= ? AND user_id != ?
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
