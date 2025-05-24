package db

import (
	"database/sql"
	"log"
)

// enableLogging is a flag to toggle logging for database operations.
var enableLogging = true

// InitializeDatabase initializes the database schema for the read receipts plugin.
func InitializeDatabase(db *sql.DB) error {
	if enableLogging {
		log.Println("Initializing database schema for read receipts...")
	}

	// SQL statement to create the message_seen table.
	createTableQuery := `
	CREATE TABLE IF NOT EXISTS message_seen (
		id SERIAL PRIMARY KEY,
		post_id VARCHAR(26) NOT NULL,
		user_id VARCHAR(26) NOT NULL,
		timestamp TIMESTAMP NOT NULL
	);
	`

	// Execute the query to create the table.
	_, err := db.Exec(createTableQuery)
	if err != nil {
		if enableLogging {
			log.Printf("Error creating message_seen table: %v", err)
		}
		return err
	}

	// SQL statements to create indexes for optimizing query performance.
	createIndexesQuery := `
	CREATE INDEX IF NOT EXISTS idx_message_id ON read_events (message_id);
	CREATE INDEX IF NOT EXISTS idx_user_id ON read_events (user_id);
	`

	// Execute the queries to create the indexes.
	_, err = db.Exec(createIndexesQuery)
	if err != nil {
		if enableLogging {
			log.Printf("Error creating indexes: %v", err)
		}
		return err
	}

	if enableLogging {
		log.Println("Database schema initialized successfully.")
	}

	return nil
}
