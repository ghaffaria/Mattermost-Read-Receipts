// server/plugin.go

package main

import (
	"database/sql"
	"fmt"
	"time"

	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin"

	"github.com/arg/mattermost-readreceipts/server/store"
)

type Plugin struct {
	plugin.MattermostPlugin
	store  store.ReceiptStore
	conf   *Configuration
	stopCh chan struct{}
}

func (p *Plugin) getConfiguration() *Configuration {
	configLock.RLock()
	defer configLock.RUnlock()
	if p.conf == nil {
		return getDefaultConfiguration()
	}
	return p.conf
}

func (p *Plugin) OnConfigurationChange() error {
	configuration := new(Configuration)

	// Load the public configuration fields from the Mattermost server configuration.
	if err := p.API.LoadPluginConfiguration(configuration); err != nil {
		return fmt.Errorf("failed to load plugin configuration: %w", err)
	}

	if err := configuration.IsValid(); err != nil {
		return fmt.Errorf("invalid configuration: %w", err)
	}

	configLock.Lock()
	defer configLock.Unlock()
	p.conf = configuration

	return nil
}

func (p *Plugin) OnActivate() error {
	if err := p.OnConfigurationChange(); err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
	}

	// Check if plugin is enabled in configuration
	if !p.getConfiguration().Enable {
		p.logInfo("[Plugin] Plugin disabled via configuration")
		return nil
	}

	p.logDebug("[Plugin] Activating read receipts plugin...")

	// Get database driver type from Mattermost config
	driverName := *p.API.GetConfig().SqlSettings.DriverName

	// Get database connection string from environment or use default
	dsn := p.API.GetConfig().SqlSettings.DataSource
	if dsn == nil || *dsn == "" {
		dsn = model.NewString("postgres://mmuser:mostest@db:5432/mattermost?sslmode=disable")
		p.logDebug("[Plugin] Using default database connection string")
	}

	// Open database connection
	db, err := sql.Open(driverName, *dsn)
	if err != nil {
		p.logError("[Plugin] Failed to connect to database", "error", err.Error())
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	// Initialize the appropriate store based on the driver
	switch driverName {
	case model.DatabaseDriverMysql:
		p.store = store.NewMySQLStore(db)
		p.logDebug("[Plugin] Using MySQL store")
	case model.DatabaseDriverPostgres:
		p.store = store.NewPostgresStore(db)
		p.logDebug("[Plugin] Using PostgreSQL store")
	default:
		return fmt.Errorf("unsupported database driver: %s", driverName)
	}

	// Initialize the store (create tables, indexes, etc)
	if err := p.store.Initialize(); err != nil {
		p.logError("[Plugin] Failed to initialize store", "error", err.Error())
		return fmt.Errorf("failed to initialize store: %w", err)
	}

	if p.getConfiguration().LogLevel != "error" {
		p.logInfo("[Plugin] Read receipts plugin activated successfully")
	}

	// Initialize cleanup goroutine
	p.stopCh = make(chan struct{})
	go func() {
		t := time.NewTicker(24 * time.Hour)
		defer t.Stop()

		for {
			select {
			case <-t.C:
				if p.conf.RetentionDays > 0 {
					if err := p.store.CleanupOlderThan(p.conf.RetentionDays); err != nil {
						p.logError("[Plugin] Failed to cleanup old receipts", "error", err.Error())
					}
				}
			case <-p.stopCh:
				return
			}
		}
	}()

	return nil
}

// Example of how to use the store interface for database operations
func (p *Plugin) StoreReadReceipt(messageID, userID string, timestamp int64) error {
	event := store.ReadEvent{
		MessageID: messageID,
		UserID:    userID,
		Timestamp: timestamp,
	}

	if err := p.store.Upsert(event); err != nil {
		p.logDebug("Failed to store read receipt",
			"messageID", messageID,
			"userID", userID,
			"error", err.Error())
		return fmt.Errorf("failed to store read receipt: %w", err)
	}
	return nil
}

func (p *Plugin) GetChannelReceipts(channelID, excludeUserID string) ([]store.ReadEvent, error) {
	events, err := p.store.GetByChannel(channelID, excludeUserID)
	if err != nil {
		p.logDebug("Failed to get channel receipts",
			"channelID", channelID,
			"error", err.Error())
		return nil, fmt.Errorf("failed to get channel receipts: %w", err)
	}
	return events, nil
}

func (p *Plugin) CleanupOldReceipts() error {
	if err := p.store.CleanupOlderThan(p.getConfiguration().RetentionDays); err != nil {
		p.logDebug("Failed to cleanup old receipts",
			"retentionDays", p.getConfiguration().RetentionDays,
			"error", err.Error())
		return fmt.Errorf("failed to cleanup old receipts: %w", err)
	}
	return nil
}

func (p *Plugin) OnDeactivate() error {
	p.logDebug("[Plugin] Deactivating read receipts plugin...")

	// Stop the cleanup goroutine
	if p.stopCh != nil {
		close(p.stopCh)
		p.stopCh = nil
	}

	return nil
}

func (p *Plugin) logDebug(msg string, kv ...interface{}) {
	if p.conf.LogLevel == "debug" {
		p.API.LogDebug(msg, kv...)
	}
}

func (p *Plugin) logInfo(msg string, kv ...interface{}) {
	if p.conf.LogLevel == "info" || p.conf.LogLevel == "debug" {
		p.API.LogInfo(msg, kv...)
	}
}

func (p *Plugin) logError(msg string, kv ...interface{}) {
	p.API.LogError(msg, kv...)
}
