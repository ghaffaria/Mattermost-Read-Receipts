// File: server/store/store.go
package store

import (
	"database/sql"
	"strings"

	"github.com/arg/mattermost-readreceipts/server/types"
)

// ReadEvent represents a read receipt event
type ReadEvent struct {
	MessageID string
	UserID    string
	ChannelID string
	Timestamp int64
}

// Tx represents a database transaction
type Tx interface {
	Commit() error
	Rollback() error
}

// ReceiptStore defines the interface for read receipt storage
type ReceiptStore interface {
	// Transaction support
	BeginTx() (Tx, error)

	// Read receipt operations
	Upsert(ReadEvent) error
	UpsertTx(tx Tx, event ReadEvent) error
	GetByChannel(channelID, excludeUserID string) ([]ReadEvent, error)
	CleanupOlderThan(days int) error
	Initialize() error

	// Channel-level receipts
	UpsertChannelRead(channelID, userID, lastPostID string, lastSeenAt int64) error
	UpsertChannelReadTx(tx Tx, read types.ChannelRead) error
	GetReadersSince(channelID string, sinceMs int64, excludeUserID string) ([]string, error)
	GetChannelReads(channelID string) ([]types.ChannelRead, error)
	InitializeChannelReads() error

	// New methods for read receipt handling
	SaveReadEvent(event ReadEvent) error
	GetMessageReaders(messageID string) ([]string, error)
}

// BaseStore provides common functionality for store implementations
type BaseStore struct {
	db *sql.DB
}

// NewBaseStore creates a new base store
func NewBaseStore(db *sql.DB) BaseStore {
	return BaseStore{
		db: db,
	}
}

// BeginTx starts a new database transaction
func (s *BaseStore) BeginTx() (Tx, error) {
	return s.db.Begin()
}

// IsUniqueViolation checks for duplicate-key errors for PostgreSQL and MySQL (single implementation)
func IsUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	errStr := err.Error()
	// PostgreSQL: pq: duplicate key value violates unique constraint
	if strings.Contains(errStr, "duplicate key value") ||
		strings.Contains(errStr, "violates unique constraint") {
		return true
	}
	// MySQL: Error 1062: Duplicate entry '...' for key '...'
	if strings.Contains(errStr, "Error 1062") ||
		strings.Contains(errStr, "Duplicate entry") {
		return true
	}
	return false
}

// Save a read event to the database
func (s *BaseStore) SaveReadEvent(event ReadEvent) error {
	_, err := s.db.Exec(
		"INSERT INTO ReadEvents (message_id, user_id, channel_id, timestamp) VALUES (?, ?, ?, ?)",
		event.MessageID, event.UserID, event.ChannelID, event.Timestamp,
	)
	return err
}

// Get all readers for a specific message
func (s *BaseStore) GetMessageReaders(messageID string) ([]string, error) {
	rows, err := s.db.Query(
		"SELECT DISTINCT user_id FROM ReadEvents WHERE message_id = ?",
		messageID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var readers []string
	for rows.Next() {
		var userID string
		if err := rows.Scan(&userID); err != nil {
			return nil, err
		}
		readers = append(readers, userID)
	}
	return readers, nil
}
