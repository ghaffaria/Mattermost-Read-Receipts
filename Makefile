PLUGIN_ID = mattermost-readreceipts
# نسخه را فقط اینجا تغییر بده، همه جا اتوماتیک استفاده میشه!
PLUGIN_VERSION = $(shell date +"%Y.%m.%d.%H%M")
OUTPUT_DIR = dist
PLUGIN_BUNDLE = $(OUTPUT_DIR)/$(PLUGIN_ID)-$(PLUGIN_VERSION).tar.gz

.PHONY: dist clean build-server build-webapp

dist: clean build-webapp build-server
	@echo "Building plugin bundle..."
	mkdir -p $(OUTPUT_DIR)
	tar -czf $(PLUGIN_BUNDLE) server webapp plugin.json
	@echo "✅ Plugin bundle created at $(PLUGIN_BUNDLE)"

clean:
	@echo "Cleaning all output directories..."
	rm -rf $(OUTPUT_DIR)/*
	rm -rf server/$(OUTPUT_DIR)/*
	rm -rf webapp/dist/*

build-webapp:
	@echo "Building webapp (webpack build)..."
	cd webapp && npm run build

build-server:
	@echo "Building server binary (plugin-linux-arm64)..."
	cd server && mkdir -p dist && GOOS=linux GOARCH=arm64 go build -o dist/plugin-linux-arm64
	@echo "✅ Server binary built at server/dist/plugin-linux-arm64"
