PLUGIN_ID=mattermost-readreceipts
PLUGIN_VERSION=0.1.0
OUTPUT_DIR=dist
PLUGIN_BUNDLE=$(OUTPUT_DIR)/$(PLUGIN_ID)-$(PLUGIN_VERSION).tar.gz

.PHONY: dist

dist:
	@echo "Building the plugin..."
	mkdir -p $(OUTPUT_DIR)
	tar -czf $(PLUGIN_BUNDLE) server webapp plugin.json
	@echo "Plugin bundle created at $(PLUGIN_BUNDLE)"
