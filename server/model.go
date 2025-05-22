//  server/model.go
// server/model.go

package main

import (
	"database/sql"
	"log"
	"time"
)

// اگر نیاز داشتی، به صورت پارامتر متد، پویایی p.API رو هم اضافه کن، ولی برای فعلاً فقط log کافیست
var enableLogging = true

// ReadEvent represents a message read event.
type ReadEvent struct {
	MessageID string // ID of the message
	UserID    string // ID of the user who read the message
	Timestamp int64  // Timestamp of when the message was read
}

// ReadRequest represents the JSON payload for the read receipt API.
type ReadRequest struct {
	MessageID string `json:"message_id"`
}

// CreateTableIfNotExists creates the read_events table if it does not already exist.
func CreateTableIfNotExists(db *sql.DB) error {
	start := time.Now()
	if enableLogging {
		log.Printf("[ReadReceipt] [%s] Trying to create 'read_events' table if not exists...", start.Format(time.RFC3339))
	}

	query := `
        CREATE TABLE IF NOT EXISTS read_events (
            message_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            timestamp BIGINT NOT NULL,
            PRIMARY KEY (message_id, user_id)
        );
    `
	res, err := db.Exec(query)
	if err != nil {
		if enableLogging {
			log.Printf("[ReadReceipt] [%s] Error creating 'read_events' table: %v", time.Now().Format(time.RFC3339), err)
		}
		return err
	}

	if enableLogging {
		affected, _ := res.RowsAffected()
		log.Printf("[ReadReceipt] [%s] 'read_events' table created (or already exists). Rows affected: %d", time.Now().Format(time.RFC3339), affected)
	}

	return nil
}
