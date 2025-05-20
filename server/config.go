package server

import (
	"sync"
)

// Config holds the plugin configuration loaded from the System Console.
type Config struct {
	EnableReadReceipts bool
	EnableLogging      bool
}

// ReadReceiptPluginConfig is the global configuration instance.
var ReadReceiptPluginConfig = &Config{}
var configLock = &sync.RWMutex{}

// OnConfigurationChange is called when the plugin configuration changes.
func (p *ReadReceiptPlugin) OnConfigurationChange() error {
	config := &Config{}

	// Load the configuration from the System Console.
	if err := p.API.LoadPluginConfiguration(config); err != nil {
		return err
	}

	// Update the global configuration instance.
	configLock.Lock()
	defer configLock.Unlock()
	*ReadReceiptPluginConfig = *config

	// Update the enableLogging variable based on the configuration.
	enableLogging = config.EnableLogging

	return nil
}
