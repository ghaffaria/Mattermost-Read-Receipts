// server/plugin.go

package main

import (
	"database/sql"
	"os"

	_ "github.com/lib/pq"
	"github.com/mattermost/mattermost-server/v6/plugin"
)

type Plugin struct {
	plugin.MattermostPlugin
	DB            *sql.DB
	enableLogging bool
}

func (p *Plugin) OnActivate() error {
	// Enable logging by default in development
	p.enableLogging = true

	p.API.LogDebug("[Plugin] Activating read receipts plugin...")

	// Get database connection string
	dsn := os.Getenv("MM_SQLSETTINGS_DATASOURCE")
	if dsn == "" {
		dsn = "postgres://mmuser:mostest@db:5432/mattermost?sslmode=disable"
		p.API.LogDebug("[Plugin] Using default database connection string")
	}

	p.API.LogDebug("[Plugin] Connecting to database...")

	// Open database connection
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		p.API.LogError("[Plugin] Failed to connect to database", "error", err.Error())
		return err
	}

	// Test the connection
	if err := db.Ping(); err != nil {
		p.API.LogError("[Plugin] Failed to ping database", "error", err.Error())
		return err
	}

	p.DB = db
	p.API.LogInfo("[Plugin] Database connection established")

	// Initialize database schema
	if err := p.initializeDatabase(); err != nil {
		p.API.LogError("[Plugin] Failed to initialize database", "error", err.Error())
		return err
	}

	p.API.LogInfo("[Plugin] Read receipts plugin activated successfully")
	return nil
}

func (p *Plugin) OnDeactivate() error {
	if p.DB != nil {
		p.API.LogInfo("[Plugin] Closing database connection")
		if err := p.DB.Close(); err != nil {
			p.API.LogError("[Plugin] Error closing database connection", "error", err.Error())
			return err
		}
	}
	return nil
}

func (p *Plugin) initializeDatabase() error {
	p.API.LogDebug("[Plugin] Initializing database schema...")

	// Create the read_events table
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

	if _, err := p.DB.Exec(query); err != nil {
		return err
	}

	p.API.LogInfo("[Plugin] Database schema initialized")
	return nil
}
