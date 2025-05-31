// server/plugin.go

package main

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/arg/mattermost-readreceipts/server/store"
	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin"
	"github.com/pkg/errors"
)

type Plugin struct {
	plugin.MattermostPlugin

	store            store.ReceiptStore // backing DB store
	readReceiptStore *ReadReceiptStore  // helper wrapper

	// Add connection tracking
	isConnected  bool
	dbConnection *sql.DB

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
		return errors.Wrap(err, "failed to load configuration")
	}

	// Enhanced logging for activation
	p.API.LogWarn("[DEBUG-RR] Plugin activation started with log level: " + p.getConfiguration().LogLevel)

	// Check if plugin is enabled in configuration
	if !p.getConfiguration().Enable {
		p.logInfo("[Plugin] Plugin disabled via configuration")
		return nil
	}

	// Close any existing connection before re-initializing
	if p.dbConnection != nil {
		if err := p.dbConnection.Close(); err != nil {
			p.logError("[Plugin] Error closing existing database connection:", "error", err.Error())
		}
		p.dbConnection = nil
		p.store = nil
		p.isConnected = false
	}

	// Get database configuration with retries
	var config *model.Config
	for attempts := 0; attempts < 3; attempts++ {
		config = p.API.GetUnsanitizedConfig()
		if config != nil && config.SqlSettings.DriverName != nil {
			break
		}
		p.logInfo("[Plugin] Waiting for Mattermost config (attempt %d of 3)", attempts+1)
		time.Sleep(time.Second)
	}

	if config == nil || config.SqlSettings.DriverName == nil {
		return errors.New("failed to get Mattermost config after retries")
	}

	driverName := *config.SqlSettings.DriverName
	p.logInfo("[Plugin] Using database driver", "driver", driverName)

	if config.SqlSettings.DataSource == nil || *config.SqlSettings.DataSource == "" {
		return errors.New("database connection string not configured")
	}

	dsn := *config.SqlSettings.DataSource

	// Open database with retry logic
	var db *sql.DB
	var err error
	for attempts := 0; attempts < 3; attempts++ {
		db, err = sql.Open(driverName, dsn)
		if err == nil {
			// Test the connection
			if err := db.Ping(); err == nil {
				break
			}
			db.Close()
		}
		p.logError("[Plugin] Database connection attempt %d failed: %v", attempts+1, err)
		time.Sleep(time.Second)
	}

	if err != nil {
		return errors.Wrap(err, "failed to establish database connection after retries")
	}

	p.dbConnection = db

	// Configure connection pool
	db.SetMaxOpenConns(5)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(time.Hour)

	// Initialize store with new connection
	switch driverName {
	case "postgres":
		p.store = store.NewPostgresStore(db)
	case "mysql":
		p.store = store.NewMySQLStore(db)
	default:
		return errors.Errorf("unsupported database driver: %s", driverName)
	}

	p.readReceiptStore = &ReadReceiptStore{Store: p.store}
	p.isConnected = true

	// Start health check goroutine
	p.stopCh = make(chan struct{})
	go p.runHealthCheck(p.stopCh)

	p.API.LogWarn("[DEBUG-RR] Plugin activation completed successfully")
	return nil
}

// Add health check routine
func (p *Plugin) runHealthCheck(stopCh chan struct{}) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-stopCh:
			return
		case <-ticker.C:
			if p.dbConnection != nil {
				if err := p.dbConnection.Ping(); err != nil {
					p.logError("[Plugin] Database health check failed:", "error", err.Error())
					p.isConnected = false
					// Trigger reactivation
					go func() {
						if err := p.OnActivate(); err != nil {
							p.logError("[Plugin] Reactivation failed:", "error", err.Error())
						}
					}()
				}
			}
		}
	}
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

	// Close the database connection if it exists
	if p.dbConnection != nil {
		if err := p.dbConnection.Close(); err != nil {
			p.logError("[Plugin] Error closing database connection:", "error", err.Error())
		}
		p.dbConnection = nil
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

// WebSocket event names (single source of truth)
const (
	EventReadReceipt    = "custom_mattermost-readreceipts_read_receipt"
	EventChannelReaders = "custom_mattermost-readreceipts_channel_readers"
)

// MessageHasBeenPosted marks the sender as having read their own post and
// notifies everyone else in the channel/DM.
func (p *Plugin) MessageHasBeenPosted(_ *plugin.Context, post *model.Post) {
	if post == nil {
		return
	}

	// 1) Persist
	_ = p.readReceiptStore.MarkPostAsRead(post.Id, post.UserId)

	// 2) Broadcast channel-level update (single-element array)
	p.API.PublishWebSocketEvent(EventChannelReaders, map[string]interface{}{
		"ChannelID":  post.ChannelId,
		"LastPostID": post.Id,
		"UserIDs":    []string{post.UserId},
	}, &model.WebsocketBroadcast{ChannelId: post.ChannelId})
}
