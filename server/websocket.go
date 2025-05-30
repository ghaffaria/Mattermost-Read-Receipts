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
	p.API.LogDebug("🚀 [WebSocket] Broadcasting WebSocketEventReadReceipt", "channelID", channelID, "userID", userID, "messageID", messageID, "timestamp", timestamp)

	eventData := map[string]interface{}{
		"MessageID": messageID,
		"UserID":    userID,
		"ChannelID": channelID,
		"Timestamp": timestamp,
	}

	broadcast := &model.WebsocketBroadcast{
		ChannelId: channelID,
	}

	p.API.LogDebug("🚀 [WebSocket] Publishing read receipt event", "event", WebSocketEventReadReceipt, "data", eventData, "broadcast", broadcast)

	// Enhanced logging before and after the publish call
	p.API.LogError("🎯 [WebSocket] CRITICAL - About to publish WebSocket event", "event", WebSocketEventReadReceipt, "channelID", channelID, "messageID", messageID, "userID", userID)

	// Get channel info for better debugging
	var channel *model.Channel
	var memberIDs []string

	channel, channelErr := p.API.GetChannel(channelID)
	if channelErr != nil {
		p.API.LogError("❌ [WebSocket] CRITICAL - Failed to get channel info", "channelID", channelID, "error", channelErr.Error())
	} else {
		p.API.LogError("📋 [WebSocket] CRITICAL - Channel info", "channelID", channelID, "channelType", channel.Type, "channelName", channel.Name, "teamID", channel.TeamId)

		// Get channel members
		members, membersErr := p.API.GetChannelMembers(channelID, 0, 100)
		if membersErr != nil {
			p.API.LogError("❌ [WebSocket] CRITICAL - Failed to get channel members", "channelID", channelID, "error", membersErr.Error())
		} else {
			memberIDs = make([]string, len(members))
			for i, member := range members {
				memberIDs[i] = member.UserId
			}
			p.API.LogError("👥 [WebSocket] CRITICAL - Channel members", "channelID", channelID, "memberCount", len(members), "memberIDs", memberIDs)
		}
	}

	// Detailed broadcast configuration logging
	p.API.LogError("📡 [WebSocket] CRITICAL - Broadcast configuration", "broadcast.ChannelId", broadcast.ChannelId, "broadcast.UserId", broadcast.UserId, "broadcast.TeamId", broadcast.TeamId, "broadcast.OmitUsers", broadcast.OmitUsers)

	p.API.PublishWebSocketEvent(
		WebSocketEventReadReceipt,
		eventData,
		broadcast,
	)

	p.API.LogError("✅ [WebSocket] CRITICAL - Read receipt event published successfully", "event", WebSocketEventReadReceipt, "channelID", channelID, "messageID", messageID, "userID", userID)

	// ADDITIONAL EXPERIMENTAL BROADCAST - Try broadcasting without channel restriction for DMs
	if channel != nil && channel.Type == "D" {
		p.API.LogError("🔄 [WebSocket] CRITICAL - Attempting additional broadcast for DM without channel restriction")

		// Try broadcast without channel restriction
		broadcastAll := &model.WebsocketBroadcast{}

		p.API.PublishWebSocketEvent(
			WebSocketEventReadReceipt+"_broadcast_all",
			eventData,
			broadcastAll,
		)

		p.API.LogError("🔄 [WebSocket] CRITICAL - Additional broadcast completed")

		// Also try broadcasting to specific users if we have channel members
		if len(memberIDs) > 0 {
			p.API.LogError("🔄 [WebSocket] CRITICAL - Attempting broadcast to specific users", "userIDs", memberIDs)

			for _, memberID := range memberIDs {
				userBroadcast := &model.WebsocketBroadcast{
					UserId: memberID,
				}

				p.API.PublishWebSocketEvent(
					WebSocketEventReadReceipt+"_user_specific",
					eventData,
					userBroadcast,
				)
			}

			p.API.LogError("🔄 [WebSocket] CRITICAL - User-specific broadcasts completed")
		}
	}

	p.API.LogDebug("✅ [WebSocket] Read receipt event published successfully")
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
