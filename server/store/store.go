// File: server/store/store.go
package store

import (
	"database/sql"

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
