// server/model.go
package main

// ReadEvent represents a message read event in the DB.
type ReadEvent struct {
	MessageID string `json:"message_id"` // ID of the message
	UserID    string `json:"user_id"`    // ID of the user who read the message
	ChannelID string `json:"channel_id"` // ID of the channel where the message was sent
	Timestamp int64  `json:"timestamp"`  // Unix timestamp (seconds) of when the message was read
}

// ReadRequest represents the JSON payload for the read receipt API.
type ReadRequest struct {
	MessageID string                 `json:"message_id"`
	ChannelID string                 `json:"channel_id"`      // Channel where the message was read
	Debug     map[string]interface{} `json:"debug,omitempty"` // Optional debug info
}

// ReadResponse represents the response payload for read receipt queries.
type ReadResponse struct {
	Events []ReadEvent `json:"events"`
}

// ChannelRead represents the latest read status for a user in a channel
type ChannelRead struct {
	ChannelID  string
	UserID     string
	LastPostID string
	LastSeenAt int64
}
