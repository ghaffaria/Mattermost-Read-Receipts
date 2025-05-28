package store

import (
	"database/sql"
	"fmt"
	"strings"
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
		channel_id VARCHAR(255) NOT NULL,
		timestamp BIGINT NOT NULL,
		PRIMARY KEY (message_id, user_id)
	)
	`
	if _, err := s.db.Exec(createTable); err != nil {
		return fmt.Errorf("failed to create read_events table: %w", err)
	}

	// Create indices if they don't exist
	indices := []string{
		"CREATE INDEX idx_read_events_message_id ON read_events(message_id)",
		"CREATE INDEX idx_read_events_user_id ON read_events(user_id)",
		"CREATE INDEX idx_read_events_channel_id ON read_events(channel_id)",
	}

	for _, idx := range indices {
		if _, err := s.db.Exec(idx); err != nil {
			if !strings.Contains(err.Error(), "Duplicate key name") {
				return fmt.Errorf("failed to create index: %w", err)
			}
		}
	}

	return nil
}

// BeginTx starts a transaction
func (s *MySQLStore) BeginTx() (Tx, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	return tx, nil
}

// UpsertTx performs an upsert within a transaction
func (s *MySQLStore) UpsertTx(tx Tx, event ReadEvent) error {
	sqlTx, ok := tx.(*sql.Tx)
	if !ok {
		return fmt.Errorf("invalid transaction type: %T", tx)
	}

	query := `
		INSERT INTO read_events (message_id, user_id, channel_id, timestamp)
		VALUES (?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE timestamp = VALUES(timestamp)
	`
	result, err := sqlTx.Exec(query, event.MessageID, event.UserID, event.ChannelID, event.Timestamp)
	if err != nil {
		return fmt.Errorf("failed to upsert read event: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get affected rows: %w", err)
	}

	if rows == 0 {
		return fmt.Errorf("upsert affected 0 rows: %+v", event)
	}

	return nil
}

// Upsert performs an upsert outside a transaction
func (s *MySQLStore) Upsert(event ReadEvent) error {
	query := `
		INSERT INTO read_events (message_id, user_id, channel_id, timestamp)
		VALUES (?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE timestamp = VALUES(timestamp)
	`
	result, err := s.db.Exec(query, event.MessageID, event.UserID, event.ChannelID, event.Timestamp)
	if err != nil {
		return fmt.Errorf("failed to upsert read event: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get affected rows: %w", err)
	}

	if rows == 0 {
		return fmt.Errorf("upsert affected 0 rows: %+v", event)
	}

	return nil
}

// CleanupOlderThan deletes old read receipts
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

// GetChannelReads moved to channel_reads.go

// GetReadersSince returns a list of unique user IDs who have seen posts in the given channel
// since the specified time. It excludes a specific user (typically the requesting user).
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

// GetByChannel retrieves read receipt events for a channel, excluding a specific user.
func (s *MySQLStore) GetByChannel(channelID, excludeUserID string) ([]ReadEvent, error) {
	query := `
		SELECT message_id, user_id, timestamp
		FROM read_events
		WHERE message_id LIKE ?
		AND user_id != ?
		ORDER BY timestamp DESC
	`
	// Use channel ID prefix to match messages in the channel
	channelPrefix := channelID + ":%"

	rows, err := s.db.Query(query, channelPrefix, excludeUserID)
	if err != nil {
		return nil, fmt.Errorf("failed to query read events: %w", err)
	}
	defer rows.Close()

	var events []ReadEvent
	for rows.Next() {
		var event ReadEvent
		if err := rows.Scan(&event.MessageID, &event.UserID, &event.Timestamp); err != nil {
			return nil, fmt.Errorf("failed to scan read event: %w", err)
		}
		events = append(events, event)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating read events: %w", err)
	}
	return events, nil
}
