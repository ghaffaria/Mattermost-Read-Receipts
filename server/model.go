//  server/model.go
package main

import (
	"database/sql"
	"log"
	"time"
)

// Global flag for extra logging (می‌توان از config بخوانی)
var enableLogging = true

// ReadEvent represents a message read event in the DB.
type ReadEvent struct {
	MessageID string // ID of the message
	UserID    string // ID of the user who read the message
	Timestamp int64  // Unix timestamp (seconds) of when the message was read
}

// ReadRequest represents the JSON payload for the read receipt API.
type ReadRequest struct {
	MessageID string `json:"message_id"`
}

// CreateTableIfNotExists creates the read_events table if it does not already exist.
func CreateTableIfNotExists(db *sql.DB) error {
	start := time.Now()
	if enableLogging {
		log.Printf("[ReadReceipt][%s] Checking or creating 'read_events' table...", start.Format(time.RFC3339))
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
			log.Printf("[ReadReceipt][%s] ERROR creating 'read_events' table: %v", time.Now().Format(time.RFC3339), err)
		}
		return err
	}

	if enableLogging {
		affected, _ := res.RowsAffected()
		log.Printf("[ReadReceipt][%s] 'read_events' table checked/created. Rows affected: %d", time.Now().Format(time.RFC3339), affected)
	}
	return nil
}

// InsertReadEvent inserts or updates a read event (idempotent upsert).
func InsertReadEvent(db *sql.DB, event *ReadEvent) error {
	if enableLogging {
		log.Printf("[ReadReceipt][%s] Inserting read event: message_id=%s, user_id=%s, timestamp=%d",
			time.Now().Format(time.RFC3339), event.MessageID, event.UserID, event.Timestamp)
	}

	query := `
		INSERT INTO read_events (message_id, user_id, timestamp)
		VALUES ($1, $2, $3)
		ON CONFLICT (message_id, user_id)
		DO UPDATE SET timestamp = EXCLUDED.timestamp;
	`
	_, err := db.Exec(query, event.MessageID, event.UserID, event.Timestamp)
	if err != nil {
		if enableLogging {
			log.Printf("[ReadReceipt][%s] ERROR inserting read event: %v", time.Now().Format(time.RFC3339), err)
		}
	}
	return err
}
