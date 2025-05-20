package main

import (
	"database/sql"

	"github.com/mattermost/mattermost-server/v6/plugin"
)

// ReadReceiptPlugin is the main plugin struct embedding MattermostPlugin.
type ReadReceiptPlugin struct {
	plugin.MattermostPlugin
	DB *sql.DB // Database connection for the plugin
}

// OnActivate is called when the plugin is activated.
func (p *ReadReceiptPlugin) OnActivate() error {
	if enableLogging {
		p.API.LogInfo("Activating ReadReceiptPlugin...")
	}

	// Initialize the database table for read receipts.
	err := CreateTableIfNotExists(p.DB)
	if err != nil {
		if enableLogging {
			p.API.LogError("Error initializing database table", "error", err.Error())
		}
		return err
	}

	if enableLogging {
		p.API.LogInfo("Database table initialized successfully.")
	}

	// Note: WebSocket events do not require registration on the server side.
	// The server only needs to publish events using p.API.PublishWebSocketEvent.

	return nil
}
