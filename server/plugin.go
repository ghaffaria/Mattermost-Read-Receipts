// server/plugin.go

package main

import (
	"database/sql"
	"fmt"
	"strings"
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
	var cfg Configuration
	if err := p.API.LoadPluginConfiguration(&cfg); err != nil {
		return fmt.Errorf("unable to load plugin config: %w", err)
	}

	if cfg.LogLevel == "" {
		cfg.LogLevel = "info"
	} else {
		cfg.LogLevel = strings.ToLower(cfg.LogLevel)
	}

	if err := cfg.IsValid(); err != nil {
		return fmt.Errorf("invalid configuration: %w", err)
	}

	configLock.Lock()
	defer configLock.Unlock()
	p.conf = &cfg

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
	config := p.API.GetUnsanitizedConfig()
	if config == nil {
		return fmt.Errorf("failed to get Mattermost config")
	}

	if config.SqlSettings.DriverName == nil {
		return fmt.Errorf("database driver name not configured")
	}

	driverName := *config.SqlSettings.DriverName
	p.logDebug("[Plugin] Using database driver", "driver", driverName)

	if config.SqlSettings.DataSource == nil || *config.SqlSettings.DataSource == "" {
		return fmt.Errorf("database connection string not configured; please set System Console → Environment → Database")
	}

	// Use the configured DSN directly
	dsn := *config.SqlSettings.DataSource
	p.logInfo("[Plugin] Using database connection from Mattermost configuration")

	// Open a new database connection using the determined DSN
	db, err := sql.Open(driverName, dsn)
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	// Test the connection
	if err := db.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
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

	// Try to initialize channel reads table, but don't fail activation if it errors
	if err := p.store.InitializeChannelReads(); err != nil {
		p.logError("[Plugin] WARNING: Failed to initialize channel_reads table - channel-level receipts will be disabled",
			"error", err.Error())
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
