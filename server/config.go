// server/config.go
package main

import (
	"fmt"
	"strings"
	"sync"
)

// Configuration holds all tunable settings exposed through the System Console.
// The struct tags allow Mattermost to map System-Console JSON into this struct
// (mapstructure) **and** let us marshal it back to JSON if ever needed.
type Configuration struct {
	Enable                bool   `json:"enable"                 mapstructure:"Enable"`                // Master on/off switch for the feature
	VisibilityThresholdMs int    `json:"visibility_threshold_ms" mapstructure:"VisibilityThresholdMs"` // Milliseconds a post must be visible before it counts as “read”
	RetentionDays         int    `json:"retention_days"          mapstructure:"RetentionDays"`         // Purge receipts older than N days
	LogLevel              string `json:"log_level"               mapstructure:"LogLevel"`              // debug | info | error
}

// getDefaultConfiguration returns the hard-coded defaults that are used
// when the plugin starts for the first time or the admin removes the config.
func getDefaultConfiguration() *Configuration {
	return &Configuration{
		Enable:                true,
		VisibilityThresholdMs: 2000,
		RetentionDays:         30,
		LogLevel:              "info",
	}
}

// IsValid performs static validation and normalisation.
// It MUST be called every time the configuration is loaded or changed.
func (c *Configuration) IsValid() error {
	// Normalise case so “Info” or “DEBUG” provided by UI won’t break validation.
	c.LogLevel = strings.ToLower(c.LogLevel)

	if c.VisibilityThresholdMs < 0 {
		return fmt.Errorf("visibility threshold must be non-negative")
	}
	if c.RetentionDays < 0 {
		return fmt.Errorf("retention days must be non-negative")
	}
	switch c.LogLevel {
	case "debug", "info", "error":
		// valid
	default:
		return fmt.Errorf("log level must be one of: debug, info, error")
	}
	return nil
}

// configLock guards read/write access to the active configuration in plugin.go.
// Use configLock.RLock/RUnlock when **reading** the config, and Lock/Unlock
// when **replacing** it inside OnConfigurationChange.
var configLock = &sync.RWMutex{}
