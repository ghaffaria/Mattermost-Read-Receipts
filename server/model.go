package server

import (
	"database/sql"
	"log"
)

// enableLogging is a flag to toggle logging for database operations.
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
	if enableLogging {
		log.Println("Creating read_events table if it does not exist...")
	}

	// SQL statement to create the read_events table.
	createTableQuery := `
	CREATE TABLE IF NOT EXISTS read_events (
		message_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		timestamp INTEGER NOT NULL,
		PRIMARY KEY (message_id, user_id)
	);
	`

	// Execute the query to create the table.
	_, err := db.Exec(createTableQuery)
	if err != nil {
		if enableLogging {
			log.Printf("Error creating read_events table: %v", err)
		}
		return err
	}

	if enableLogging {
		log.Println("read_events table created successfully.")
	}

	return nil
}
