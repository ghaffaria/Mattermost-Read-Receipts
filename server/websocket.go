package main

import (
	"github.com/mattermost/mattermost-server/v6/model"
)

// WebSocket event names
const (
	WebSocketEventReadReceipt    = "custom_mattermost-readreceipts_read_receipt"
	WebSocketEventChannelReaders = "custom_mattermost-readreceipts_channel_readers"
)

// PublishReadReceipt publishes a WebSocket event when a message is read
func (p *Plugin) PublishReadReceipt(channelID, messageID, userID string, timestamp int64) {
	// This function is deprecated - all WebSocket events are now handled in HandleReadReceipt
	p.API.LogDebug("⚠️ [WebSocket] Deprecated PublishReadReceipt called",
		"channelID", channelID,
		"messageID", messageID,
		"userID", userID,
	)
}

// PublishChannelReadersUpdate publishes a websocket event when UpsertChannelRead succeeds
func (p *Plugin) PublishChannelReadersUpdate(channelID, lastPostID string, userIDs []string) {
	p.API.LogDebug("🚀 [WebSocket] Broadcasting WebSocketEventChannelReadersUpdate", "channelID", channelID, "lastPostID", lastPostID, "userIDs", userIDs)

	eventData := map[string]interface{}{
		"ChannelID":  channelID,
		"LastPostID": lastPostID,
		"UserIDs":    userIDs,
	}

	broadcast := &model.WebsocketBroadcast{
		ChannelId: channelID,
	}

	p.API.LogDebug("🚀 [WebSocket] Publishing channel readers event", "event", WebSocketEventChannelReaders, "data", eventData, "broadcast", broadcast)

	p.API.PublishWebSocketEvent(
		WebSocketEventChannelReaders,
		eventData,
		broadcast,
	)

	p.API.LogDebug("✅ [WebSocket] Channel readers event published successfully")
}
