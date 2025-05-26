package main

import (
	"fmt"
	"sync"
)

// Configuration represents the plugin's configuration
type Configuration struct {
	Enable                bool   `json:"enable" mapstructure:"Enable"`
	VisibilityThresholdMs int    `json:"visibility_threshold_ms" mapstructure:"VisibilityThresholdMs"`
	RetentionDays         int    `json:"retention_days" mapstructure:"RetentionDays"`
	LogLevel              string `json:"log_level" mapstructure:"LogLevel"`
}

// getDefaultConfiguration returns the default configuration
func getDefaultConfiguration() *Configuration {
	return &Configuration{
		Enable:                true,
		VisibilityThresholdMs: 2000,
		RetentionDays:         30,
		LogLevel:              "info",
	}
}

// IsValid checks if the configuration is valid
func (c *Configuration) IsValid() error {
	if c.VisibilityThresholdMs < 0 {
		return fmt.Errorf("visibility threshold must be non-negative")
	}
	if c.RetentionDays < 0 {
		return fmt.Errorf("retention days must be non-negative")
	}
	if c.LogLevel != "debug" && c.LogLevel != "info" && c.LogLevel != "error" {
		return fmt.Errorf("log level must be one of: debug, info, error")
	}
	return nil
}

var configLock = &sync.RWMutex{}
