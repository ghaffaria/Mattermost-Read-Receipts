// server/types/types.go

package types

// ReadEvent represents a message read event.
type ReadEvent struct {
	MessageID string // ID of the message
	UserID    string // ID of the user who read the message
	Timestamp int64  // Timestamp of when the message was read
}

// ReadRequest represents the JSON payload for the read receipt API.
type ReadRequest struct {
	MessageID string `json:"message_id"`
}

// ChannelRead represents the latest read status for a user in a channel
type ChannelRead struct {
	ChannelID  string
	UserID     string
	LastPostID string
	LastSeenAt int64
}
