package store

import (
	"database/sql"
)

// ReadEvent represents a read receipt event
type ReadEvent struct {
	MessageID string
	UserID    string
	Timestamp int64
}

// ReceiptStore defines the interface for read receipt storage
type ReceiptStore interface {
	// Upsert creates or updates a read receipt
	Upsert(ReadEvent) error

	// GetByChannel retrieves all read receipts for a channel, excluding a specific user
	GetByChannel(channelID, excludeUserID string) ([]ReadEvent, error)

	// CleanupOlderThan removes receipts older than specified days
	CleanupOlderThan(days int) error

	// Initialize initializes the store (creates tables, indexes, etc)
	Initialize() error
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
