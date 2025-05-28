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
	p.API.LogDebug("Broadcasting WebSocketEventReadReceipt", "channelID", channelID, "userID", userID, "messageID", messageID, "timestamp", timestamp)
	p.API.PublishWebSocketEvent(
		WebSocketEventReadReceipt,
		map[string]interface{}{
			"MessageID": messageID,
			"UserID":    userID,
			"ChannelID": channelID,
			"Timestamp": timestamp,
		},
		&model.WebsocketBroadcast{
			ChannelId: channelID,
		},
	)
}

// PublishChannelReadersUpdate publishes a websocket event when UpsertChannelRead succeeds
func (p *Plugin) PublishChannelReadersUpdate(channelID, lastPostID string, userIDs []string) {
	p.API.LogDebug("Broadcasting WebSocketEventChannelReadersUpdate", "channelID", channelID, "lastPostID", lastPostID, "userIDs", userIDs)
	p.API.PublishWebSocketEvent(
		WebSocketEventChannelReaders,
		map[string]interface{}{
			"ChannelID":  channelID,
			"LastPostID": lastPostID,
			"UserIDs":    userIDs,
		},
		&model.WebsocketBroadcast{
			ChannelId: channelID,
		},
	)
}
