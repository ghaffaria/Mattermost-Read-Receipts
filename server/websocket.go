package main

import (
	"github.com/mattermost/mattermost-server/v6/model"
)

// PublishChannelReadersUpdate publishes a websocket event when UpsertChannelRead succeeds
func (p *Plugin) PublishChannelReadersUpdate(channelID, lastPostID string, userIDs []string) {
	p.API.PublishWebSocketEvent(
		"channel_readers_update",
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
