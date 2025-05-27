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
	p.API.PublishWebSocketEvent(
		WebSocketEventReadReceipt,
		map[string]interface{}{
			"message_id": messageID,
			"user_id":    userID,
			"channel_id": channelID,
			"timestamp":  timestamp,
		},
		&model.WebsocketBroadcast{
			ChannelId: channelID,
		},
	)
}

// PublishChannelReadersUpdate publishes a websocket event when UpsertChannelRead succeeds
func (p *Plugin) PublishChannelReadersUpdate(channelID, lastPostID string, userIDs []string) {
	p.API.PublishWebSocketEvent(
		WebSocketEventChannelReaders,
		map[string]interface{}{
			"channel_id":   channelID,
			"last_post_id": lastPostID,
			"user_ids":     userIDs,
		},
		&model.WebsocketBroadcast{
			ChannelId: channelID,
		},
	)
}
