// File: server/config.go

package store

import (
	"database/sql"
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
	cutoff := time.Now().AddDate(0, 0, -days).Unix()
	query := "DELETE FROM read_events WHERE timestamp < ?"
	_, err := s.db.Exec(query, cutoff)
	return err
}
