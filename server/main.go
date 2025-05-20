package main

import (
	"github.com/mattermost/mattermost-server/v6/plugin"
	// import your plugin type
)

func main() {
	plugin.ClientMain(&ReadReceiptPlugin{})
}
