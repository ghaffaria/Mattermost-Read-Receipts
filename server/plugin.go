package main

import (
	"database/sql"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
	"github.com/mattermost/mattermost-server/v6/plugin"
)

// ReadReceiptPlugin is the main plugin struct.
type ReadReceiptPlugin struct {
	plugin.MattermostPlugin
	DB            *sql.DB
	enableLogging bool
}

// OnActivate initializes the plugin and database.
func (p *ReadReceiptPlugin) OnActivate() error {
	p.loadConfiguration()

	if p.enableLogging {
		p.API.LogInfo("Activating ReadReceiptPlugin...")
	}

	// Get the plugin's data directory path
	dataPath, err := p.API.GetBundlePath()
	if err != nil {
		p.API.LogError("Failed to get plugin bundle path", "error", err.Error())
		return err
	}

	// Create or connect to the SQLite DB file
	dbPath := filepath.Join(dataPath, "readreceipts.db")
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		p.API.LogError("Failed to open SQLite database", "error", err.Error())
		return err
	}
	p.DB = db

	// Ensure the read-receipt table exists
	if err := CreateTableIfNotExists(p.DB); err != nil {
		p.API.LogError("Failed to initialize DB table", "error", err.Error())
		return err
	}

	if p.enableLogging {
		p.API.LogInfo("ReadReceiptPlugin activated successfully.")
	}

	return nil
}

// loadConfiguration sets plugin options; extend this to load from actual config.
func (p *ReadReceiptPlugin) loadConfiguration() {
	p.enableLogging = true // hardcoded; replace with dynamic config if needed
}
