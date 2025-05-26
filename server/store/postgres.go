package store

import (
	"database/sql"
	"time"
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
		PRIMARY KEY (message_id, user_id)
	);
	CREATE INDEX IF NOT EXISTS idx_read_events_message_id ON read_events(message_id);
	CREATE INDEX IF NOT EXISTS idx_read_events_user_id ON read_events(user_id);
	`
	_, err := s.db.Exec(query)
	return err
}

func (s *PostgresStore) Upsert(event ReadEvent) error {
	query := `
		INSERT INTO read_events (message_id, user_id, timestamp)
		VALUES ($1, $2, $3)
		ON CONFLICT (message_id, user_id)
		DO UPDATE SET timestamp = EXCLUDED.timestamp
	`
	_, err := s.db.Exec(query, event.MessageID, event.UserID, event.Timestamp)
	return err
}

func (s *PostgresStore) GetByChannel(channelID, excludeUserID string) ([]ReadEvent, error) {
	query := `
		SELECT message_id, user_id, timestamp
		FROM read_events re
		WHERE message_id LIKE $1
		AND user_id != $2
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

func (s *PostgresStore) CleanupOlderThan(days int) error {
	cutoff := time.Now().AddDate(0, 0, -days).UnixNano() / int64(time.Millisecond)
	query := "DELETE FROM read_events WHERE timestamp < $1"
	_, err := s.db.Exec(query, cutoff)
	return err
}
